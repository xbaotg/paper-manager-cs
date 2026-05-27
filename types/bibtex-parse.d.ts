declare module 'bibtex-parse' {
  export interface BibTeXEntry {
    key: string;
    type: string;
    TITLE?: string;
    title?: string;
    YEAR?: string;
    year?: string;
    AUTHOR?: string;
    author?: string;
    BOOKTITLE?: string;
    booktitle?: string;
    JOURNAL?: string;
    journal?: string;
    DOI?: string;
    doi?: string;
    URL?: string;
    url?: string;
    [key: string]: string | undefined;
  }
  
  const bibtexParse: {
    entries(input: string): BibTeXEntry[];
    toJSON(input: string): BibTeXEntry[];
    toBibtex(json: BibTeXEntry[], compact?: boolean): string;
  };
  
  export default bibtexParse;
}
