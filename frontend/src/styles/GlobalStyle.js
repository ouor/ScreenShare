
import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
    * {
        box_sizing: border-box;
        margin: 0;
        padding: 0;
    }

    body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        background-color: #121212;
        color: #ffffff;
        line-height: 1.6;
    }

    button {
        cursor: pointer;
        border: none;
        outline: none;
        font-family: inherit;
    }

    a {
        text-decoration: none;
        color: inherit;
    }
`;

export default GlobalStyle;
