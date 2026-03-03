declare module 'espeak-ng' {
    const factory: any;
    export default factory;
}

// Support for Vite Worker constructors
declare module '*?worker' {
    const workerConstructor: {
        new (): Worker;
    };
    export default workerConstructor;
}