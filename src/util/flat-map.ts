export default function flatMap<T, TResult>(collection: T[], selector:(item: T) => TResult[]): TResult[]{    
    return collection.reduce((acc,curr) => [
            ...acc,
            ...selector(curr)
        ]
    ,<TResult[]>[])    
}