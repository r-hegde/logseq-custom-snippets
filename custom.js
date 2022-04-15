// common =================================================================
MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

// throttle MutationObserver 
// from https://stackoverflow.com/a/52868150
  const throttle = (func, limit) => {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = setTimeout(() => (inThrottle = false), limit);
      }
    };
  };

// query table resizer by cannibalox ============================================== 
// source : https://htmldom.dev/resize-columns-of-a-table/   
    console.log("========= query table resizer v20220312 ============");

    const createResizableColumn = function (col, resizer) {
      // Track the current position of mouse
      let x = 0;
      let w = 0;

      const mouseDownHandler = function (e) {
        // Get the current mouse position
        x = e.clientX;

        // Calculate the current width of column
        const styles = window.getComputedStyle(col);
        w = parseInt(styles.width, 10);

        // Attach listeners for document's events
        document.addEventListener("mousemove", mouseMoveHandler);
        document.addEventListener("mouseup", mouseUpHandler);
      };

      const mouseMoveHandler = function (e) {
        // Determine how far the mouse has been moved
        const dx = e.clientX - x;
        // Update the width of column
        col.style.width = `${w + dx}px`;
      };

      // When user releases the mouse, remove the existing event listeners
      const mouseUpHandler = function () {
        document.removeEventListener("mousemove", mouseMoveHandler);
        document.removeEventListener("mouseup", mouseUpHandler);
      };
      resizer.addEventListener("mousedown", mouseDownHandler);
    };

    const updateTables = function () {
      // Query the table
      const table = document.querySelectorAll(".table-auto:not(.table-resizable)");
      for (let i = 0; i < table.length; i++) {
        // Query all headers1
        const cols = table[i].querySelectorAll("th.whitespace-nowrap");
        // Loop ver them
        Array.from(cols).forEach((col) => {
          // Create a resizer element
          const resizer = document.createElement("div");
          resizer.classList.add("query-table-resizer");
          table[i].classList.add("table-resizable");
          console.info("-- injected div.query-table-resizer --");
          // Set the height
          resizer.style.height = "20px";
          // Add a resizer element to the column
          col.appendChild(resizer);
          createResizableColumn(col, resizer);
        });
      }
    };

    const updateTablesThrottled = throttle(updateTables, 1000);
    const obsTable = new MutationObserver(updateTablesThrottled);
    const watchTarget = document.getElementById("app-container");
    obsTable.observe(watchTarget, {
      subtree: true,
      childList: true,
    }); 
// ====================================================== query table resizer


const shouldTrigger = (e) => {
  return e.key === "g" && e.ctrlKey;
};

const addCss = (css) => {
  const sheet = document.styleSheets[0];
  sheet.insertRule(css, sheet.cssRules.length);
};

const hintTagCssRules = [
  `
.logseq-hints-tag {
    position: absolute;
    left: -5px;
    top: -5px;
    padding: 2px;
    line-height: 1;
    border-radius: 2px;
    background: tomato;
    color: white;
    opacity: 0.85;
    font-weight: 600;
    text-transform: uppercase;
}
`,
  `
.logseq-hints-tag.matched-1 span:nth-child(-n + 1) {
  color: tomato;
}
`,
  `
  .logseq-hints-tag.matched-2 span:nth-child(-n + 2) {
    color: tomato;
  }
`,
];

hintTagCssRules.forEach(addCss);

let hints = {};
let matchedCount = 0;

function* hintCodes(count, letters = "abcdefghijklmnopqrstuvwxyz") {
  let codeLength = Math.ceil(Math.log(count) / Math.log(letters.length));
  let gen = 0;
  // Construct an array where the digits represent how many codes incrementing
  // that position represents. Examples:
  // [26, 0]     : each first letter represents a block of 26 codes, like AA, AB, AC, etc
  // [676, 26, 0]: now the first letter spans 26**2 codes, AAA, AAB, AAC, etc and the second letter spans 26
  const digitValues = Array.from({ length: codeLength }, (_, i) =>
    Math.pow(letters.length, codeLength - i - 1)
  );
  while (gen < count) {
    let unallocated = gen;
    const code = digitValues.map((digitValue, _) => {
      // thisDigit will be 0 if we don't need to increment it yet (eg codes 0-25 for a-z)
      const thisDigit = Math.floor(unallocated / digitValue);
      unallocated = unallocated - thisDigit * digitValue;
      return letters[thisDigit];
    });
    gen++;
    yield code.join("");
  }
}

const displayHints = () => {
  const blocks = Array.from(
    document.querySelectorAll("div.block-content[blockid]")
  );
  if (blocks.length <= 0) return;
  const codes = Array.from(hintCodes(blocks.length));
  matchedCount = 0;
  blocks.forEach((b, i) => {
    const onHinted = () => logseq.api.edit_block(b.getAttribute("blockId"));
    const tag = document.createElement("div");
    tag.setAttribute("data-logseq-hints", "");
    tag.classList.add("logseq-hints-tag");
    tag.innerHTML = codes[i]
      .split("")
      .map((l) => `<span>${l}</span>`)
      .join("");
    hints[tag.textContent] = { tag, onHinted };
    b.prepend(tag);
  });
};

const clearHints = () => {
  document
    .querySelectorAll("[data-logseq-hints]")
    .forEach((hint) => hint.remove());
  hints = {};
  matchedCount = 0;
};

document.addEventListener("keydown", (e) => {
  const hasHints = Object.keys(hints).length > 0;
  if (!hasHints) {
    return shouldTrigger(e) ? displayHints() : null;
  }
  const matches = Object.fromEntries(
    Object.entries(hints).filter(([k, _]) => k.startsWith(e.key))
  );
  e.preventDefault();
  e.stopPropagation();
  if (e.code === "Escape" || Object.keys(matches).length === 0) {
    clearHints();
    // The preventDefault strategy doesn't work here for some reason. Instead
    // refocus the current block on an short timeout. This seems to allow
    // Logseq to process the escape, defocus the block, then refocus it. Sans
    // setTimeout this doesn't work. This does make an annoying visual glitch
    // where editing mode is exited and then immediately reentered. If the
    // timeout is too short the escape fires after the edit and the block is
    // selected instead of editing.
    const editing = logseq.api.check_editing();
    const pos = logseq.api.get_editing_cursor_position()?.pos || 0;
    if (editing) setTimeout(() => logseq.api.edit_block(editing, { pos }), 100);
    return;
  }
  const completedHint = matches[e.key];
  if (completedHint !== undefined) {
    completedHint.onHinted();
    clearHints();
    return;
  }
  // Multiple matches: awaiting more keystrokes
  matchedCount++;
  console.log(hints);
  console.log(matches);
  Object.entries(hints).forEach(([k, v]) => {
    if (matches[k] === undefined) {
      v.tag.remove();
    } else {
      hints[k.slice(1)] = v;
      v.tag.classList.add(`matched-${matchedCount}`);
    }
    delete hints[k];
  });
});
