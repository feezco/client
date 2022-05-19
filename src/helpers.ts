export function toPascalCase(str: string) {
  return `${str}`
    .replace(new RegExp(/[-_]+/, "g"), " ")
    .replace(new RegExp(/[^\w\s]/, "g"), "")
    .replace(
      new RegExp(/\s+(.)(\w*)/, "g"),
      ($1, $2, $3) => `${$2.toUpperCase() + $3.toLowerCase()}`
    )
    .replace(new RegExp(/\w/), (s) => s.toUpperCase());
}

export const kebabize = (str: string): string =>
  str.replace(
    /[A-Z]+(?![a-z])|[A-Z]/g,
    ($, ofs) => (ofs ? "-" : "") + $.toLowerCase()
  );

export const styleObjectToString = ({
  styleObject,
  isImportant,
}: {
  styleObject: Record<string, string>;
  isImportant?: boolean;
}) => {
  let styleString = "";

  const styleKeys = Object.keys(styleObject);

  for (const eachStyleKey of styleKeys) {
    styleString += `${kebabize(eachStyleKey)}: ${styleObject[eachStyleKey]} ${
      isImportant ? "!important" : ""
    };`;
  }

  return styleString;
};
