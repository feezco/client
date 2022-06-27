import axios from "axios";

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

  const syncButtons = div.querySelectorAll('#feezco-sync-button');
  i = syncButtons.length;
  while (i--) {
    syncButtons?.[i]?.parentNode?.removeChild(syncButtons[i]);
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

const postMessageCrossOrigin = (websiteId: string) => {
  const domain = "http://localhost:7777";
  if (!newWindow || newWindow.closed) {
    window.focus();
    newWindow = window.open(
      domain + `/websites/${websiteId}${location.pathname}`,
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

export const initFeezcoEditor = ({ websiteId }: { websiteId: string }): void => {
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
    buttonEl.style.cursor = 'pointer'
    buttonEl.addEventListener("click", () => postMessageCrossOrigin(websiteId));

    document.body.appendChild(buttonEl);
  }, 1000);
};

type PageContent<T> = T extends T ? T : T;

export const getClientSidePageContent = async <T>({
  path,
  key,
  env,
}: {
  path: string;
  key: string;
  env: string;
}): Promise<PageContent<T> | void> => {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const getCookie = (cname: string): string => {
      const name = cname + "=";
      const ca = document.cookie.split(";");
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == " ") {
          c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
          return c.substring(name.length, c.length);
        }
      }
      return "";
    };

    const setCookie = (cname: string, cvalue: string, exdays: number) => {
      const d = new Date();
      d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
      let expires = "expires=" + d.toUTCString();
      document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    };

    const populateMissingElementsBrowser = ({
      pagePath,
      data,
    }: {
      pagePath: string;
      data: Record<string, unknown>;
    }) => {
      return data;
    };

    const feezcoCachedContentFromCookie = getCookie("feezco_cached");

    const cachedContentDataRes =
      feezcoCachedContentFromCookie && process.env.FEEZCO_STAGE !== "PRODUCTION"
        ? JSON.parse(feezcoCachedContentFromCookie)
        : null;

    const resData =
      cachedContentDataRes ||
      ((
        await axios.get(
          `https://cdn.feezco.com/page?path=${path}&key=${key}&stage=${env}`
        )
      ).data as PageContent<T>);

    if (!cachedContentDataRes && resData) {
      setCookie("feezco_cached", JSON.stringify(resData), 100000);
    }

    // @ts-expect-error type error
    return populateMissingElementsBrowser({ pagePath: path, data: resData });
  }
};