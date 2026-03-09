module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^react-native$': 'react-native-web',
    },
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
};
