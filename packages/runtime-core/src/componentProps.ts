import { reactive } from "@vue/reactivity";
import { hasOwn } from "@vue/shared";


export function initProps(instance,rawProps){
    const props = {};
    const attrs = {};

    const options = instance.propsOptions || {};

    if(rawProps){
        for(let key in rawProps){
            const value = rawProps[key];
            if(hasOwn(options,key)){
                props[key] = value;
            }else{
                attrs[key] = value;
            }
        }
    }
    // 这里props不希望在组件内部被更改，但是props得是响应式的，因为后续属性变化了要更新视图， 用的应该是shallowReactive
    instance.props = reactive(props)
    instance.attrs = attrs;
}

export let hasPropsChanged = (prevProps = {},nextProps = {}) =>{
    let nextKeys = Object.keys(nextProps)
    let prevKeys = Object.keys(prevProps)
    if(nextKeys.length !== prevKeys.length){
        return true
    }
    for(let i =0; i<nextKeys.length;i++){
        let key = nextKeys[i];
        if(nextProps[key] !==prevProps[key]){
            return true
        }
    }
    return false
}
export function updateProps(prevProps,nextProps){
    // 性能优化: 属性变化才更新.
    // 1. 值得变化 2. 属性的个数是否发生变化


        for(let key in nextProps){
            prevProps[key] = nextProps[key]; // 这个就修改了,响应式-会触发页面修改
        }
        for(let key in prevProps){ // 万一是减少属性
            if(!hasOwn(nextProps,key)){ // 新属性里是否有当前属性,如果没有就是减少了
                delete prevProps[key]
            }
        }

}