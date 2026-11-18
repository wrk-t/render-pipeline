import { createContext } from "react";

/**
 * True while rendering inside a screen layout that already renders the screen
 * title and description. Content that would otherwise repeat the title (a form
 * prints its own name) reads this and stays quiet.
 */
export const ScreenContentContext = createContext(false);
