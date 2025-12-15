import consola from "consola";

export const namespace = "tcml";

const root = consola.withTag("TuneCore MIDI Lyrics");
export const createLogger = (scope: string) => {
  return root.withTag(scope);
};

export function matchUrl(path: string, pattern: string): boolean {
  const regex = new RegExp(
    `^${pattern.replaceAll(".", "\\.").replaceAll("*", ".*")}(?:\\?.*)?$`,
  );
  return regex.test(path);
}

export function maybeGetElementsBySelector<T extends Element>(
  selector: string,
  from: Document | Element = document,
): T[] {
  return Array.from(from.querySelectorAll<T>(selector));
}
export function getElementsBySelector<T extends Element>(
  selector: string,
  from: Document | Element = document,
): T[] {
  const elements = maybeGetElementsBySelector<T>(selector, from);
  if (elements.length === 0) {
    throw new Error(`No elements found for selector: ${selector}`);
  }
  return elements;
}
export function waitForElementBySelector<T extends Element>(
  selector: string,
  from: Document | Element = document,
  timeout: number = 10000, // Default timeout of 10 seconds
): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  const startTime = Date.now();
  setInterval(() => {
    const element = maybeGetElementBySelector<T>(selector, from);
    if (element) {
      resolve(element);
    }
    if (Date.now() - startTime > timeout) {
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }
  }, 100);
  return promise;
}

export function maybeGetElementBySelector<T extends Element>(
  selector: string,
  from: Document | Element = document,
): T | null {
  return from.querySelector<T>(selector);
}

export function getElementBySelector<T extends Element>(
  selector: string,
  from: Document | Element = document,
): T {
  const element = maybeGetElementBySelector<T>(selector, from);
  if (!element) {
    throw new Error(`No element found for selector: ${selector}`);
  }
  return element;
}

export function insertStyle(css: string): () => void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  return () => {
    if (style.parentElement) {
      style.parentElement.removeChild(style);
    }
  };
}
