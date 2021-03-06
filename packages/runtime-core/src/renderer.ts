import { ReactiveEffect } from "@vue/reactivity";
import { reactive } from "@vue/reactivity";
import { hasOwn, isArray, isString, ShapeFlags } from "@vue/shared";
import { createComponentInstance, setupComponent } from "./component";


import { hasPropsChanged, initProps, updateProps } from "./componentProps";
import { queneJob } from "./scheduler";

import { Text ,createVnode,isSameVnode, Fragment} from "./vnode";



export function createRenderer(renderOptions){
    let  {
    // 增加 删除 修改 查询
        insert:hostInsert,
        remove:hostRemove,
        setElementText:hostSetElementText,
        setText:hostSetText,
        parentNode:hostParentNode,
        nextSibling:hostNextSibling,
        createElement:hostCreateElement,
        createText:hostCreateText,
        patchProp:hostPatchProp
        // 文本节点 ， 元素中的内容
    } = renderOptions

    const normalize = (children,i)=>{
        if(isString(children[i])){
            let vnode = createVnode(Text,null,children[i])
            children[i] = vnode;
        }
        return children[i];
    }
    const mountChildren = (children,container) =>{
        for(let i = 0; i < children.length;i++){
            let child = normalize(children,i); // 处理后要进行替换，否则childrne中存放的已经是字符串
            patch(null,child,container)
        }
    }
    const mountElement = (vnode,container,anchor)=>{
        let {type,props,children,shapeFlag} = vnode;
        let el = vnode.el = hostCreateElement(type); // 将真实元素挂载到这个虚拟节点上，后续用于复用节点和更新
        if(props){
            for(let key in props){
                hostPatchProp(el,key,null,props[key])
            }
        }
        if(shapeFlag & ShapeFlags.TEXT_CHILDREN){ // 文本
            hostSetElementText(el,children)
        }else if(shapeFlag & ShapeFlags.ARRAY_CHILDREN){ // 数组
            mountChildren(children,el)
        }
        hostInsert(el,container,anchor)
    }

    const processText = (n1,n2,container)=>{
        if(n1 === null){
            hostInsert((n2.el = hostCreateText(n2.children)),container)
        }else{
            // 文本的内容变化了，我可以复用老的节点
            const el =  n2.el = n1.el;
            if(n1.children !== n2.children){
                hostSetText(el,n2.children); // 文本的更新
            }
        }
    }


    const patchProps = (oldProps,newProps,el)=>{
        for(let key in newProps){ // 新的里面有，直接用新的盖掉即可
            hostPatchProp(el,key,oldProps[key],newProps[key]);
        }
        for(let key in oldProps){ // 如果老的里面有新的没有，则是删除
            if(newProps[key] == null){
                hostPatchProp(el,key,oldProps[key],undefined);
            }
        }
    }
    const unmountChildren = (children) =>{
        for(let i = 0; i < children.length;i++){
            unmount(children[i]);
        }
    }
    const patchKeyedChildren = (c1,c2,el) =>{ // 比较两个儿子的差异

        let i = 0;
        let e1 = c1.length-1;
        let e2 = c2.length - 1;

        // 特殊处理..................................................

        // sync from start
        while(i<=e1 && i<=e2){ // 有任何一方停止循环则直接跳出
            const n1 = c1[i];
            const n2 = c2[i];
            if(isSameVnode(n1,n2)){
                patch(n1,n2,el); // 这样做就是比较两个节点的属性和子节点
            }else{
                break;
            }
            i++
        }
        // sync from end
        while(i<=e1 && i<=e2){
            const n1 = c1[e1];
            const n2 = c2[e2];
            if(isSameVnode(n1,n2)){
                patch(n1,n2,el);
            }else{
                break;
            }
            e1--;
            e2--;
        }
        // common sequence + mount
        // i要比e1大说明有新增的 
        // i和e2之间的是新增的部分 

        // 有一方全部比较完毕了 ，要么就删除 ， 要么就添加
        if(i > e1){
            if(i<=e2){
                while(i <=e2){
                    const nextPos = e2 + 1;
                    // 根据下一个人的索引来看参照物
                    const anchor =nextPos < c2.length ?  c2[nextPos].el : null
                    patch(null,c2[i],el,anchor); // 创建新节点 扔到容器中
                    i++;
                }
            }
        }else if(i> e2){
            if(i<=e1){
                while(i<=e1){
                    unmount(c1[i])
                    i++;
                }
            }
        }
        // common sequence + unmount
        // i比e2大说明有要卸载的
        // i到e1之间的就是要卸载的

        // 优化完毕************************************
        // 乱序比对
        let s1 = i;
        let s2 = i;
        const keyToNewIndexMap = new Map(); // key -> newIndex
        for(let i = s2; i<=e2;i++){
            keyToNewIndexMap.set(c2[i].key,i)
        }
        

        // 循环老的元素 看一下新的里面有没有，如果有说明要比较差异，没有要添加到列表中，老的有新的没有要删除
        const toBePatched = e2 - s2 + 1; // 新的总个数
        const newIndexToOldIndexMap = new Array(toBePatched).fill(0); // 一个记录是否比对过的映射表 
        for(let i = s1; i<=e1; i++){
            const oldChild = c1[i]; // 老的孩子
            let newIndex =  keyToNewIndexMap.get(oldChild.key); // 用老的孩子去新的里面找
            if(newIndex == undefined){
                unmount(oldChild); // 多余的删掉
            }else{
                // 新的位置对应的老的位置 , 如果数组里放的值>0说明 已经pactch过了
                newIndexToOldIndexMap[newIndex-s2] = i+1; // 用来标记当前所patch过的结果
                patch(oldChild,c2[newIndex],el)
            }
        } // 到这这是新老属性和儿子的比对，没有移动位置
        
        
        // 需要移动位置
        for(let i =toBePatched - 1; i>=0; i-- ){
            let index = i + s2;
            let current = c2[index]; // 找到h
            let anchor = index + 1 < c2.length ? c2[index+1].el : null;
            if(newIndexToOldIndexMap[i] === 0){ // 创建   5 3 4 0
                patch(null,current,el,anchor)
            }else{ // 不是0 说明是已经比对过属性和儿子的了
                hostInsert(current.el,el,anchor); // 目前无论如何都做了一遍倒叙插入，其实可以不用的， 可以根据刚才的数组来减少插入次数 
            }

           // 这里发现缺失逻辑 我需要看一下current有没有el。如果没有el说明是新增的逻辑

           // 最长递增子序列来实现  vue2 在移动元素的时候会有浪费  优化
        }


    }
    const patchChildren = (n1,n2,el) =>{
        // 比较两个虚拟节点的儿子的差异 ， el就是当前的父节点
        const c1 = n1.children;
        const c2 = n2.children;
        const prevShapeFlag = n1.shapeFlag; // 之前的
        const shapeFlag = n2.shapeFlag; // 之后的
        // 文本  空的null  数组


        // 比较两个儿子列表的差异了 
        // 新的 老的
        if(shapeFlag & ShapeFlags.TEXT_CHILDREN){
            if(prevShapeFlag & ShapeFlags.ARRAY_CHILDREN){ 
                // 删除所有子节点
                unmountChildren(c1)  // 文本	数组	（删除老儿子，设置文本内容）
            }
            if(c1 !== c2){ // 文本	文本	（更新文本即可）  包括了文本和空
                hostSetElementText(el,c2)
            }
        }else{
            // 现在为数组或者为空
            if(prevShapeFlag & ShapeFlags.ARRAY_CHILDREN){
                if(shapeFlag & ShapeFlags.ARRAY_CHILDREN){  // 数组	数组	（diff算法）
                    // diff算法
                    patchKeyedChildren(c1,c2,el); // 全量比对
                }else{
                    // 现在不是数组 （文本和空 删除以前的）
                    unmountChildren(c1); // 空	数组	（删除所有儿子）
                }
            }else{
                if(prevShapeFlag & ShapeFlags.TEXT_CHILDREN){ 
                    hostSetElementText(el,'')   // 数组	文本	（清空文本，进行挂载）
                }   // 空	文本	（清空文本）
                if(shapeFlag & ShapeFlags.ARRAY_CHILDREN){ 
                    mountChildren(c2,el)   // 数组	文本	（清空文本，进行挂载）
                }
            }
        }
    }

    const patchElement = (n1,n2) =>{ // 先复用节点、在比较属性、在比较儿子
        let el =  n2.el = n1.el;
        let oldProps = n1.props || {}; // 对象
        let newProps = n2.props || {}; // 对象

        patchProps(oldProps,newProps,el);
        patchChildren(n1,n2,el);
    }


    const processElement = (n1,n2,container,anchor) => {
        if(n1 === null){
            mountElement(n2,container,anchor);
        }else{
            // 元素比对
           patchElement(n1,n2)
        }
    }
    const processFragment = (n1,n2,container) =>{
        if(n1 == null){
            mountChildren(n2.children,container)
        }else{
            patchChildren(n1,n2,container); // 走的是diff算法
        }   
    }


    let mountComponent = (vnode,container,anchor) =>{
        // 1.创建组件实例
       let instance =  vnode.component =    createComponentInstance(vnode); // 创建实例后,放到了虚拟节点的component属性上存储. 并且因为后面还需要使用,所以创建变量接受

        // 2.实例上赋值
        setupComponent(instance)

        // 3.实例做成effect,获得响应式. 就是一个渲染逻辑
        setupRenderEffect(instance, container, anchor)

        

 

  
    }

    let updateComponentPreRender = (instance,next)=>{
        instance.next = null; // next清空
        instance.vnode = next; // 实例上最新的虚拟节点
        updateProps(instance.props,next.props)
    }
    function setupRenderEffect(instance, container, anchor) {
        let { render } = instance;
        let componentUpdateFn = () => { // 传入响应式的方法,既有初始化,又有更新方法. 响应式是需要个函数,等到触发的时候要调用.
    
            if (!instance.isMounted) { // 初始化
                let subTree = render.call(instance.proxy); // 保存this,后续要改
                patch(null, subTree, container, anchor); // subTree就是虚拟节点. 使用patch挂载后就是真实节点,并且插入了.
                instance.subTree = subTree;
    
                instance.isMounted = true
            } else { // 组件内部更新 
                let { next } = instance;
                if(next){ // 更新前,也要需要拿到最新的属性 来进行更新
                    updateComponentPreRender(instance,next)

                }

                let subTree = render.call(instance.proxy);
                patch(instance.subTree, subTree, container, anchor); // 1. 老树就是实例上的树,新树就是从新new的树 patch会自动diff算法 
                instance.subTree = subTree;
    
            }
        }
        let effect = new ReactiveEffect(componentUpdateFn, () => queneJob(instance.update)); // queneJob是因为如果多个单个响应式,两次触发的话. 会渲染两次,所以会使用异步缓存机制存储任务队列,等到异步以后再触发渲染.
    
        // 将组件强制更新的逻辑,保存到实例上. 后续可以使用.
        let update = instance.update = effect.run.bind(effect); // 默认不执行,需要默认执行一次. 且会让组件强制重新渲染
        update()
    }

    let shouldUpdateComponent = (n1,n2)=>{
        // 1. 前后属性不一致更新=> 直接比对对象
        // 2. 插槽的情况下,只要存在就直接更新
        // 3. 比对是否个数/每个值有变化就更新
        let {props : prevProps,children:prevChildren } = n1;
        let {props : nextProps,children: nextChildren } = n2;
        if(prevProps === nextProps){
            return false
        }
        if(prevChildren || nextChildren){
            return true; // 只要前后有插槽,就要强制更新
        }
        if(hasPropsChanged(prevProps,nextProps)){
            return true
        }
        return false
    }
    let updateComponent = (n1,n2,container) =>{
        // instance.props 是响应式的,可以更改后会触发渲染
        // 因为是更新,所以组件实例可以直接复用. 可能是后面的更新点做修改就可以了.
        let instnace =  (n2.component = n1.component) // 对于组件复用,组件复用实例. 对于元素(感觉是dom元素)来说,复用dom节点 

        // updateProps(instnace,prevProps,nextProps); // 属性更新就可以了

        if(shouldUpdateComponent(n1,n2)){
            // 需要更新就强制调用属性的update即可
            instnace.next = n2; // 存一下新的虚拟节点到next属性上
            instnace.update(); // 如果应该更新,直接更新. 统一调用update方法
        }


        // 后续插槽更新,逻辑会写相同的两份
    }

    let processComponent = (n1, n2, container,anchor) =>{ // 组件的更新/渲染 => 这里面区分函数式组件/状态组件 函数式组件是vue2的性能好且多节点 .但是到了vue3已经优化成了状态组件性能忽略不计且也可以多节点,所以多使用状态组件.
        if(n1 == null){ // 新增
            mountComponent(n2,container,anchor)
        }else{ // 更新更新靠的props
            updateComponent(n1,n2,container)
        }
        
    }
    const patch = (n1,n2,container,anchor = null) => { //  核心的patch方法
        if(n1 === n2) return;
        if(n1 && !isSameVnode(n1,n2)){ // 判断两个元素是否相同，不相同卸载在添加
            unmount(n1); // 删除老的
            n1 = null
        }
        const {type,shapeFlag} = n2
        switch(type){
            case Text:
                processText(n1,n2,container);
              break;
            case Fragment:
                processFragment(n1, n2, container);
            break;
            default:
                if(shapeFlag & ShapeFlags.ELEMENT){
                    processElement(n1,n2,container,anchor);
                }else if(shapeFlag & ShapeFlags.COMPONENT){
                    processComponent(n1, n2, container,anchor); // 组件的更新&&组件的渲染处理函数
                }
        }
    }
    const unmount = (vnode) =>{
        hostRemove(vnode.el);
    }
    // vnode 虚拟dom
    const render = (vnode,container) =>{ // 渲染过程是用你传入的renderOptions来渲染
        if(vnode == null){
            // 卸载逻辑
            if(container._vnode){ // 之前确实渲染过了，那么就卸载掉dom
                unmount(container._vnode); // el
            }
        }else{
            // 这里既有初始化的逻辑，又有更新的逻辑
            patch(container._vnode || null,vnode,container)
        }
        container._vnode = vnode
        // 如果当前vnode是空的话 
    }
    return {
        render
    }
}
// 文本的处理, 需要自己增加类型。因为不能通过document.createElement('文本')
// 我们如果传入null的时候在渲染时，则是卸载逻辑，需要将dom节点删掉


// 1) 更新的逻辑思考：
// - 如果前后完全没关系，删除老的 添加新的
// - 老的和新的一样， 复用。 属性可能不一样， 在比对属性，更新属性
// - 比儿子