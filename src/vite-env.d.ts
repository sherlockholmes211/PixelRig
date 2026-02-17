// Type declarations for GLSL shader imports via Vite's ?raw query

declare module '*.frag?raw' {
    const content: string;
    export default content;
}

declare module '*.vert?raw' {
    const content: string;
    export default content;
}

declare module '*.glsl?raw' {
    const content: string;
    export default content;
}
