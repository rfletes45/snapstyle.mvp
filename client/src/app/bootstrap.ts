import { GameApp } from "./GameApp";

let app: GameApp | null = null;

export function bootstrapGame(root: HTMLElement | null): void {
  if (!root) {
    throw new Error("Missing #app mount node.");
  }
  app = new GameApp(root);
  app.start();
}
