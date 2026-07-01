import mainStyles from "./main.ass";
import styles from "./button.ass";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

app.innerHTML = `
  <main class="${mainStyles.root}">
    <h1>css-but-ai sample app</h1>
    <p>This button class is generated from a .ass prompt at compile time.</p>
    <button class="${styles.root} ${styles.cta}">AI Styled Button</button>
  </main>
`;
