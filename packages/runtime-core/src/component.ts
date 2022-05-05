import { reactive } from "@vue/reactivity";
import { hasOwn, isFunction } from "@vue/shared";
import { initProps } from "./componentProps";

export function createComponentInstance(vnode) {
    let instance = { // 组件的实例 => 有些属性不能只是记录在虚拟节点上,而是用组件实例来记录
        data: null, // 组件的状态 => 用户传入的,还没定义是state
        vnode, // 组件的虚拟节点
        subTree: null, // 组件的render执行结果(最终渲染的样子),就在这里存储   => vue2的源码节点中: 虚拟节点叫$vnode,渲染内容叫_vnode.很绕  但是vue3改成了subTree(也就是渲染结果叫 渲染子节点)
        isMounted: false, // 是否挂载成功
        update: null, // 组件自身的强制更新方法 => effect.run方法
        propsOptions: vnode.type.props, // 就是所有的props
        props: {},
        attrs: {},
        proxy: null, // 代理对象,既能取到state,又能props,又attrs
        render: null
    } // 需要做成响应式,就用 effect
    return instance
}


let publicPropertyMap = {
    $attrs: (i) => i.attrs
}

let publicInstanceProxy = {
    get(target, key) {
        let { data, props } = target;

        if (data && hasOwn(data, key)) {
            return data[key]
        } else if (props && hasOwn(props, key)) {
            return props[key]
        }
        let getter = publicPropertyMap[key];
        if (getter) {
            console.log(getter(target));

            return getter(target)
        }
    },
    set(target, key, value) {
        let { data, props } = target;
        if (data && hasOwn(data, key)) {
            data[key] = value;
            return true

            // 用户操作属性是代理对象,这里面被屏蔽
            // 但是可以操作instance.props修改
        } else if (props && hasOwn(props, key)) {
            console.warn('props不能修改')
            return false
        }
        return true;
    }
}

export function setupComponent(instance) {
    let { props, type } = instance.vnode;

    // 初始化属性
    initProps(instance, props);

    // 初始化代理对象 
    instance.proxy = new Proxy(instance, publicInstanceProxy)

    let data = type.data
    if (data) {
        // vue3都是函数, vue2可以是函数/组件
        if (!isFunction(data)) {
            console.warn('must function');
        } else {
            instance.data = reactive(data.call(instance.proxy))
        }
    }

    instance.render = type.render; // 就是用户的render,后面还要用他的渲染结果赋值给subTree呢
}

// export 