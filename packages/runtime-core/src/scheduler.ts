let queue = [];
let isFlushing = false;
let resolvePromise = Promise.resolve(); // 创造一个成功的promise


export function queneJob(job){
    if(!queue.includes(job)){
        queue.push(job)
    }
    if(!isFlushing){
        isFlushing = true;
        resolvePromise.then(()=>{
            isFlushing = false;
            let copy = queue.slice(0)
            queue.length = 0;
            copy.forEach(item=>{
                item()
            })
            copy.length = 0;
        })
    }
}