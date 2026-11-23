const DEFAULT_TITLE = 'Global';

export function mountApp(doc: Document, title: string = DEFAULT_TITLE): void {
  const root = doc.getElementById('app');
  if (root === null) {
    throw new Error('No se encontro el contenedor #app en el documento');
  }
  const heading = doc.createElement('h1');
  heading.textContent = title;
  root.replaceChildren(heading);
}
