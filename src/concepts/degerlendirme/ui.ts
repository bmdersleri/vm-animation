/** Small DOM constructors shared by the evaluation teaching scenes. */
export function html<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string,string> = {}, ...children: (Node|string)[]): HTMLElementTagNameMap[K] {
  const node=document.createElement(tag);
  for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);
  node.append(...children);
  return node;
}
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string,string> = {}, text?: string): SVGElementTagNameMap[K] {
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);
  if(text!==undefined)node.textContent=text;
  return node;
}
