
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

export const initFeezco = ({ websiteId }: { websiteId: string }): void => {
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