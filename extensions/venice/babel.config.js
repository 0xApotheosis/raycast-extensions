module.exports = {
    plugins: [
        // Enable React Compiler for the entire project
        // See: https://react.dev/learn/react-compiler
        ['babel-plugin-react-compiler', {
            // Compile all components and hooks by default
            compilationMode: 'all',
        }],
    ],
};
