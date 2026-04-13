import { createOptimizedPicture } from "../../scripts/aem.js";
import { moveInstrumentation } from "../../scripts/scripts.js";

export default function decorate(block) {
  const rows = [...block.children];
  const imageRow = rows[0];
  const contentRow = rows[1];

  // Build image container
  const imageContainer = document.createElement("div");
  imageContainer.className = "teaser-image";
  if (imageRow) {
    moveInstrumentation(imageRow, imageContainer);
    const pic = imageRow.querySelector("picture");
    if (pic) {
      const img = pic.querySelector("img");
      if (img) {
        const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [
          { width: "750" },
        ]);
        moveInstrumentation(img, optimizedPic.querySelector("img"));
        imageContainer.append(optimizedPic);
      }
    }
  }

  // Build content container
  const contentContainer = document.createElement("div");
  contentContainer.className = "teaser-content";
  if (contentRow) {
    moveInstrumentation(contentRow, contentContainer);
    while (contentRow.firstElementChild) {
      contentContainer.append(contentRow.firstElementChild);
    }
  }

  block.replaceChildren(imageContainer, contentContainer);
}
