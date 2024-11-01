// ==UserScript==
// @name         Wanikani: Reorder Omega
// @namespace    http://tampermonkey.net/
// @version      1.3.57
// @description  Reorders n stuff
// @author       Kumirei
// @match        https://www.wanikani.com/*
// @match        https://preview.wanikani.com/*
// @require      https://greasyfork.org/scripts/489759-wk-custom-icons/code/CustomIcons.js?version=1417568
// @require      https://greasyfork.org/scripts/462049-wanikani-queue-manipulator/code/WaniKani%20Queue%20Manipulator.user.js?version=1426722
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

// These lines are necessary to make sure that TSC does not put any exports in the
// compiled js, which causes the script to crash
var module = {};
export = null;

// Extend the global window object to declare an already-existing WK Open Framework
declare global {
    interface Window {
        wkof: any
    }
}

;(async () => {
  // Script info
  const script_id = "add-meaning";
  const script_name = "Add Meaning";
  const wkof_version_needed = "1.1.0";

  // Globals
  const { wkof } = window;

  // Initiate WKOF
  loading_screen(true); // Hide session until script has loaded

  confirm_wkof();

  async function load_wkof() {
    wkof.include("ItemData");

    await wkof.ready("ItemData");
  }

  await load_wkof();

  install_css();

  function loading_screen(state: boolean) {
    if (state) document.body.classList.add(`${script_id}__loading`);
    else document.body.classList.remove(`${script_id}__loading`);
  }

  function install_css() {
    if (document.getElementById(script_id)) return;

    const css = `
        /* body.${script_id}__loading > #loading { display: block !important; opacity: 1 !important  } */
    `;

    document.head.append(`<style id="${script_id}_css">${css}</style>`);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // WKOF SETUP
  // -----------------------------------------------------------------------------------------------------------------

  // Makes sure that WKOF is installed
  function confirm_wkof() {
    if (!wkof) {
      let response = confirm(
        `${script_name} requires WaniKani Open Framework.\nClick "OK" to be forwarded to installation instructions.`
      );
      if (response) {
        window.location.href =
          "https://community.wanikani.com/t/instructions-installing-wanikani-open-framework/28549";
      }
    } else {
      if (
        !wkof.version ||
        wkof.version.compare_to(wkof_version_needed) === "older"
      ) {
        let response = confirm(
          `${script_name} requires WaniKani Open Framework version ${wkof_version_needed} or higher.\nClick "OK" to be forwarded to the update page.`
        );
        if (response) {
          window.location.href =
            "https://greasyfork.org/en/scripts/38582-wanikani-open-framework";
        }
      }
    }
  }
})()