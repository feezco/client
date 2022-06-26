import axios from "axios";
import dotenv from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "fs";

dotenv.config();
export interface FeezcoPage {
  elements: Record<string, unknown>;
}

type PageContent<T> = T extends T ? T : T;

const feezcoConfig = existsSync(`${process.cwd()}/feezco.config.json`)
  ? readFileSync(`${process.cwd()}/feezco.config.json`, "utf-8")
  : null;

if (!feezcoConfig) {
  throw new Error(
    "Cannot find feezco config file. Please make sure feezco.config.json is set up in your project root."
  );
}

const feezcoPlaceholders = existsSync(
  `${process.cwd()}/feezco.placeholders.json`
)
  ? readFileSync(`${process.cwd()}/feezco.placeholders.json`, "utf-8")
  : null;

const feezcoConfigParsed: { pages: Record<string, string>; key: string } =
  JSON.parse(feezcoConfig);

const feezcoPlaceholdersParsed: Record<string, string> = feezcoPlaceholders
  ? JSON.parse(feezcoPlaceholders)
  : null;

const populateMissingElements = ({
  pagePath,
  data,
}: {
  pagePath: string;
  data: Record<string, unknown>;
}) => {
  const key = Object.keys(feezcoConfigParsed.pages).find(
    (k) => feezcoConfigParsed.pages[k] === pagePath
  );

  if (key && feezcoPlaceholdersParsed[key]) {
    const missingElementsKeys = Object.keys(feezcoPlaceholdersParsed[key]);

    for (const elementKey of missingElementsKeys) {
      // @ts-expect-error
      if (!data.elements[elementKey]) {
        // @ts-expect-error
        data.elements[elementKey] = feezcoPlaceholdersParsed[key][elementKey];
      }
    }
  }

  return data;
};

export const getPageContent = async <T>(
  path: string
): Promise<PageContent<T>> => {
  const cachedContentDataRes =
    existsSync(`${__dirname}/cachedContentData.json`) &&
    process.env.FEEZCO_STAGE !== "PRODUCTION"
      ? JSON.parse(readFileSync(`${__dirname}/cachedContentData.json`, "utf-8"))
      : null;

  const feezcoConfig = existsSync(`${process.cwd()}/feezco.config.json`)
    ? JSON.parse(readFileSync(`${process.cwd()}/feezco.config.json`, "utf-8"))
    : null;

  const resData =
    cachedContentDataRes ||
    ((
      await axios.get(
        `https://cdn.feezco.com/page?path=${path}&key=${feezcoConfig.key}&stage=${process.env.FEEZCO_STAGE}`
      )
    ).data as PageContent<T>);

  if (!cachedContentDataRes && resData) {
    writeFileSync(
      `${__dirname}/cachedContentData.json`,
      JSON.stringify(resData)
    );
  }

  // @ts-expect-error type error
  return populateMissingElements({ pagePath: path, data: resData });
};

const stripScripts = (s: string) => {
  const div = document.createElement("div");
  div.innerHTML = s;
  const scripts = div.getElementsByTagName("script");
  let i = scripts.length;
  while (i--) {
    scripts?.[i]?.parentNode?.removeChild(scripts[i]);
  }

  let noscripts = div.getElementsByTagName("noscript");
  i = noscripts.length;
  while (i--) {
    noscripts?.[i]?.parentNode?.removeChild(noscripts[i]);
  }

  noscripts = div.getElementsByTagName("noscript");
  i = noscripts.length;
  while (i--) {
    noscripts?.[i]?.parentNode?.removeChild(noscripts[i]);
  }

  const linkScripts = div.querySelectorAll('[as="script"]');
  i = linkScripts.length;
  while (i--) {
    linkScripts?.[i]?.parentNode?.removeChild(linkScripts[i]);
  }

  return div.innerHTML;
};

const getAllCss = () => {
  var css = [];

  const styleSheets = document.styleSheets;

  for (let i = 0; i < styleSheets.length; i++) {
    try {
      const rules = styleSheets[i].rules;

      if (rules && rules.length) {
        for (let j = 0; j < rules.length; j++) {
          if (rules[j].cssText) {
            css.push(rules[j].cssText);
          }
        }
      }
    } catch (err) {
      continue;
    }
  }

  return css.join(" ");
};

let newWindow: WindowProxy | null = null;

const postMessageCrossOrigin = () => {
  const domain = "http://localhost:7777";
  if (!newWindow || newWindow.closed) {
    window.focus();
    newWindow = window.open(
      domain + `/wk/${feezcoConfigParsed.key}/p${location.pathname}`,
      "feezco-cms-window"
    );
  } else {
    newWindow.focus();
  }

  if (newWindow) {
    newWindow.postMessage(
      {
        html: stripScripts(document.body.innerHTML),
        css: getAllCss(),
        picture: "",
      },
      domain
    );
  }
};

const maxZIndex = (): number => {
  return (
    Array.from(document.querySelectorAll("body *"))
      .map((a) => parseFloat(window.getComputedStyle(a).zIndex))
      .filter((a) => !isNaN(a))
      .sort()
      .pop() || 0
  );
};

export const initFeezco = (): void => {
  if (!window) {
    return;
  }

  const feezcoSyncButton = document.getElementById("feezco-sync-button");
  if (feezcoSyncButton) {
    document.body.removeChild(feezcoSyncButton);
  }
  setTimeout(() => {
    const buttonEl = document.createElement("button");
    buttonEl.id = "feezco-sync-button";
    buttonEl.innerHTML = "Sync";
    buttonEl.style.position = "fixed";
    buttonEl.style.bottom = "64px";
    buttonEl.style.right = "64px";
    buttonEl.style.width = "64px";
    buttonEl.style.height = "64px";
    buttonEl.style.borderRadius = "50%";
    buttonEl.style.zIndex = String(maxZIndex() + 1);
    buttonEl.addEventListener("click", postMessageCrossOrigin);

    document.body.appendChild(buttonEl);
  }, 1000);
};
