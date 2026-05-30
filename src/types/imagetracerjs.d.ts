declare module "imagetracerjs" {
  type Options = Partial<{
    numberofcolors: number;
    ltres: number;
    qtres: number;
    pathomit: number;
    strokewidth: number;
    colorsampling: number;
    mincolorratio: number;
    colorquantcycles: number;
    [k: string]: unknown;
  }>;
  const ImageTracer: {
    imagedataToSVG(imageData: ImageData, options?: Options): string;
    imageToSVG(url: string, cb: (svg: string) => void, options?: Options): void;
  };
  export default ImageTracer;
}
