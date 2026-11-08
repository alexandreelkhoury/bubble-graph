// wrangler Text modules (JAMAA-PLATFORM §5.6): `import x from "./a.txt"` gives the file's contents as a string.
declare module "*.txt" {
  const text: string;
  export default text;
}
