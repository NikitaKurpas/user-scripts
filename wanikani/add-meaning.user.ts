// ==UserScript==
// @name         WaniKani: Lesson Picker Meaning
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  Adds meanings to items in the Lesson Picker
// @author       nkurpas
// @match        https://www.wanikani.com/subject-lessons/picker
// @match        https://preview.wanikani.com/subject-lessons/picker
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

// These lines are necessary to make sure that TSC does not put any exports in the
// compiled js, which causes the script to crash
var module = {};
export = null;

const API_KEY = "";

declare global {
  interface Window {
    addMeaning?: AddMeaning.Extension;
  }
}

namespace AddMeaning {
  export function main() {
    // TODO: REMOVE API KEY!
    const apiGateway = new WKAPIGateway(API_KEY);
    const service = new WKService(apiGateway);
    const extension = new Extension(service);
    extension.init();
    window.addMeaning = extension;

    // loading_screen(true); // Hide session until script has loaded

    // install_css();

    // function loading_screen(state: boolean) {
    //   if (state) document.body.classList.add(`${script_id}__loading`);
    //   else document.body.classList.remove(`${script_id}__loading`);
    // }

    // function install_css() {
    //   if (document.getElementById(script_id)) return;

    //   const css = `
    //       /* body.${script_id}__loading > #loading { display: block !important; opacity: 1 !important  } */
    //   `;

    //   document.head.append(`<style id="${script_id}_css">${css}</style>`);
    // }
  }

  export class Extension {
    #extension_id = "add-meaning";

    #service: SubjectService;
    #rootController?: HTMLElement;
    #showingMeaning: boolean = false;
    #sectionVisibilityKey = "add-meaning-section-visibility";
    #meaningVisibilityKey = "add-meaning-visibility";

    constructor(service: SubjectService) {
      this.#service = service;
    }

    init() {
      console.debug("Initializing AddMeaningExtension");

      this.#rootController =
        document.querySelector("div[data-controller].lesson-picker") ?? void 0;

      if (!this.#rootController) {
        console.debug('No "lesson-picker" controller found, aborting.');
        return;
      }

      this.#installCSS();
      this.#installMeaningToggle();
      this.#installSectionToggles();
      this.#installMeanings();
    }

    #installCSS() {
      console.debug("Installing the CSS");

      const styleId = `${this.#extension_id}_css`;
      if (document.getElementById(styleId)) return;

      const css = `
      .add-meaning__toggle-meaning {
        margin: 0 0px 11px 10px;
      }

      .add-meaning__subject-meaning {
        display: none;
        font-size: calc(var(--font-size-xsmall) * 0.8);
        line-height: 1.15em;
        margin-inline-start: var(--spacing-xtight);
        max-width: 66%;
        max-height: 2.3em;
        text-overflow: ellipsis;
        white-space: normal;
        text-align: end;
      }

      .add-meaning__content--hidden {
        display: none;
      }

      .add-meaning--on .lesson-picker__subject {
        width: 100%;
      }

      .add-meaning--on .lesson-picker__subject .subject-character__characters {
        width: 100%;
        display: inline-flex;
        justify-content: space-between;
        align-items: center;
      }

      .add-meaning--on .lesson-picker__subject .subject-character__characters > .add-meaning__subject-meaning {
        display: initial;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      @media only screen and (min-width: 1024px) {
        .add-meaning--on .lesson-picker__subjects {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-tight);
        }

        .add-meaning--on .lesson-picker__subject {
          flex: 1 1 calc(50% - var(--spacing-tight));
        }
      }
    `;

      document.head.insertAdjacentHTML(
        "beforeend",
        `<style id="${styleId}">${css}</style>`.trim()
      );
    }

    #installMeaningToggle() {
      console.debug("Installing the toggle");

      const initialVisibilityState =
        this.#loadMeaningVisibilityState() ?? false;

      const button = htmlToElement(`
      <button class="page-header__title-subtext lesson-picker__section-toggle-all add-meaning__toggle-meaning">Toggle Meaning</button>
      `);

      const toggleVisibility = (forceVisibility?: boolean) => {
        if (forceVisibility != null) {
          this.#showingMeaning = forceVisibility;
        } else {
          this.#showingMeaning = !this.#showingMeaning;
        }

        if (this.#showingMeaning) {
          this.#showMeaning();
        } else {
          this.#hideMeaning();
        }

        this.#saveMeaningVisibilityState(this.#showingMeaning);
      };

      toggleVisibility(initialVisibilityState);

      button.addEventListener("click", () => {
        toggleVisibility();
      });

      this.#rootController
        ?.querySelector(".page-header__title")
        ?.appendChild(button);
    }

    #installMeanings() {
      console.debug("Installing the meanings");

      const subjectElements =
        this.#rootController?.querySelectorAll(
          "[data-subject-id].lesson-picker__subject"
        ) ?? [];

      const subjectElementMap = new Map<number, Element>();
      for (const subject of subjectElements) {
        const attrValue = subject.getAttribute("data-subject-id");
        const subjectId = attrValue ? parseInt(attrValue) : undefined;

        if (subjectId) {
          subjectElementMap.set(subjectId, subject);
        }
      }

      // Install a placeholder
      subjectElements.forEach((subject) => {
        const meaning = "⏳";
        const readingContainer = subject.querySelector(
          ".subject-character__characters"
        );
        readingContainer?.insertAdjacentHTML(
          "beforeend",
          `<span class="add-meaning__subject-meaning" lang="en">${meaning}</span>`.trim()
        );
      });

      const subjectIds = [...subjectElementMap.keys()];
      this.#service.getSubjectsByIds(subjectIds).then((subjects) => {
        subjects.forEach((subject) => {
          const subjectElement = subjectElementMap.get(subject.id);
          if (subjectElement == null) return;

          const meaning = subject.data.meanings
            .map((m) => m.meaning)
            .join(", ");
          const meaningContainer = subjectElement.querySelector(
            ".add-meaning__subject-meaning"
          );
          if (meaningContainer != null) {
            meaningContainer.textContent = meaning;
          }
        });
      }).catch((error) => {
        console.error("Failed to fetch subjects", error);
      });
    }

    #installSectionToggles() {
      console.debug("Installing the section toggles");

      const sections = this.#rootController?.querySelectorAll(
        "div[data-controller].lesson-picker__level"
      );

      const visibilityStates = this.#loadSectionVisibilityStates();

      sections?.forEach((section) => {
        const panelContent = section.querySelector(".wk-panel__content");
        const panelTitle = section.querySelector(".wk-panel__title");

        const level =
          panelTitle?.textContent?.match(/level\s*(\d+)/i)?.[1] ?? void 0;
        const initialVisibilityState =
          level != null ? visibilityStates[level] ?? true : true;

        const selectAllButton = section.querySelector(
          "button.lesson-picker__section-toggle"
        );

        const toggleSectionVisibilityButton = htmlToElement(`
          <button class="lesson-picker__section-toggle add-meaning__section-visibility-toggle">Toggle Show/Hide</button>
          `);

        const toggleSectionVisibility = (forceState?: boolean) => {
          if (forceState === false) {
            panelContent?.classList.add("add-meaning__content--hidden");
          } else if (forceState === true) {
            panelContent?.classList.remove("add-meaning__content--hidden");
          } else {
            panelContent?.classList.toggle("add-meaning__content--hidden");
          }

          const isVisible = !panelContent?.classList.contains(
            "add-meaning__content--hidden"
          );

          if (isVisible) {
            toggleSectionVisibilityButton.textContent = "Hide All";
          } else {
            toggleSectionVisibilityButton.textContent = "Show All";
          }

          if (level) {
            visibilityStates[level] = isVisible;
            this.#saveSectionVisibilityStates(visibilityStates);
          }
        };

        toggleSectionVisibility(initialVisibilityState);

        toggleSectionVisibilityButton.addEventListener("click", () => {
          toggleSectionVisibility();
        });

        selectAllButton?.insertAdjacentElement(
          "beforebegin",
          toggleSectionVisibilityButton
        );
      });
    }

    #showMeaning() {
      document.body.classList.toggle("add-meaning--on", true);
    }

    #hideMeaning() {
      document.body.classList.toggle("add-meaning--on", false);
    }

    #loadSectionVisibilityStates(): Partial<Record<string, boolean>> {
      const states = localStorage.getItem(this.#sectionVisibilityKey);
      return states ? JSON.parse(states) : {};
    }

    #saveSectionVisibilityStates(states: Partial<Record<string, boolean>>) {
      localStorage.setItem(this.#sectionVisibilityKey, JSON.stringify(states));
    }

    #loadMeaningVisibilityState(): boolean | undefined {
      const state = localStorage.getItem(this.#meaningVisibilityKey);
      return state ? JSON.parse(state) : undefined;
    }

    #saveMeaningVisibilityState(state: boolean) {
      localStorage.setItem(this.#meaningVisibilityKey, JSON.stringify(state));
    }
  }

  export interface SubjectService {
    getSubjectsByIds(subjectIds: number[]): Promise<Subject[]>;
  }

  /**
   * Example usage:
   * const gateway = new WKAPIGateway('your_api_key_here');
   * const service = new WKService(gateway);
   * service.getSubjectsByIds(['440', '441']).then(subjects => console.log(subjects));
   */
  export class WKService implements SubjectService {
    #gateway: WKAPIGateway;
    #cacheKey: string = "wk_subject_cache";

    constructor(gateway: WKAPIGateway) {
      this.#gateway = gateway;
    }

    /**
     * Fetch subjects by IDs, using a cache to minimize API requests.
     * @param subjectIds An array of subject IDs to fetch.
     * @returns A promise that resolves to an array of Subject objects.
     */
    public async getSubjectsByIds(subjectIds: number[]): Promise<Subject[]> {
      console.debug("Fetching subjects");
      // Retrieve the cache from localStorage or initialize an empty cache
      const cachedSubjects = this.loadCache();
      const missingIds = subjectIds.filter((id) => !cachedSubjects[id]);

      // If there are no missing subjects, return the cached subjects directly
      if (missingIds.length === 0) {
        console.debug("All subjects found in cache");
        return subjectIds
          .map((id) => cachedSubjects[id])
          .filter((s) => s != null);
      }

      // Fetch missing subjects from the API
      console.debug("Fetching missing subjects");
      const fetchedSubjects: APISubject[] = [];
      for (const idsChunk of chunk(missingIds, 1000)) {
        const fetchedChunk = await this.#gateway.getSubjectsByIds(idsChunk);
        fetchedSubjects.push(...fetchedChunk);
      }
      console.debug(`Fetched ${fetchedSubjects.length} subjects`);

      // Trim fetched subjects
      const trimmedSubjects = fetchedSubjects.map(trimSubject);

      // Add fetched subjects to the cache
      for (const subject of trimmedSubjects) {
        cachedSubjects[subject.id] = subject;
      }

      // Update the localStorage cache
      console.debug("Updating cache");
      this.saveCache(cachedSubjects);

      // Return the complete list of subjects from cache and fetched results
      return subjectIds
        .map((id) => cachedSubjects[id])
        .filter((s) => s != null);
    }

    /**
     * Loads the subject cache from localStorage.
     * @returns A dictionary of cached subjects.
     */
    private loadCache(): Partial<Record<string, Subject>> {
      const cache = localStorage.getItem(this.#cacheKey);
      return cache ? JSON.parse(cache) : {};
    }

    /**
     * Saves the updated subject cache to localStorage.
     * @param cache A dictionary of subjects to store.
     */
    private saveCache(cache: Partial<Record<string, Subject>>): void {
      localStorage.setItem(this.#cacheKey, JSON.stringify(cache));
    }
  }

  type Subject = {
    id: number;
    object: string;
    // url: string;
    data_updated_at: string;
    data: {
      // created_at: string;
      level: number;
      slug: string;
      hidden_at: string | null;
      // document_url: string;
      characters: string;
      meanings: {
        meaning: string;
        primary: boolean;
        accepted_answer: boolean;
      }[];
      readings: {
        type: string;
        primary: boolean;
        accepted_answer: boolean;
        reading: string;
      }[];
      component_subject_ids: number[];
      amalgamation_subject_ids: number[];
      visually_similar_subject_ids: number[];
      // meaning_mnemonic: string;
      // meaning_hint?: string;
      // reading_mnemonic: string;
      // reading_hint?: string;
      // lesson_position: number;
      // spaced_repetition_system_id: number;
    };
  };

  export class StubSubjectService implements SubjectService {
    getSubjectsByIds(subjectIds: number[]): Promise<Subject[]> {
      return Promise.resolve([]);
    }
  }

  // Utility function to trim APISubject to Subject
  function trimSubject(apiSubject: APISubject): Subject {
    return {
      id: apiSubject.id,
      object: apiSubject.object,
      data_updated_at: apiSubject.data_updated_at,
      data: {
        level: apiSubject.data.level,
        slug: apiSubject.data.slug,
        hidden_at: apiSubject.data.hidden_at,
        characters: apiSubject.data.characters,
        meanings: apiSubject.data.meanings,
        readings: apiSubject.data.readings,
        component_subject_ids: apiSubject.data.component_subject_ids,
        amalgamation_subject_ids: apiSubject.data.amalgamation_subject_ids,
        visually_similar_subject_ids:
          apiSubject.data.visually_similar_subject_ids,
      },
    };
  }

  /**
   * Example usage:
   * const gateway = new WKAPIGateway('your_api_key_here');
   * gateway.getSubjectsByIds(['440', '441']).then(subjects => console.log(subjects));
   */
  export class WKAPIGateway {
    #apiKey: string;
    #apiUrl: string = "https://api.wanikani.com/v2/subjects";

    constructor(apiKey: string) {
      this.#apiKey = apiKey;
    }

    /**
     * Fetches subjects from the WaniKani API based on provided subject IDs.
     * @param subjectIds An array of subject IDs to fetch.
     * @returns A promise that resolves to an array of Subject objects.
     */
    public async getSubjectsByIds(subjectIds: number[]): Promise<APISubject[]> {
      console.debug("Fetching subjects from API");
      if (subjectIds.length > 1000) {
        throw new Error("Cannot fetch more than 1000 subjects at once");
      }

      const url = new URL(this.#apiUrl);
      url.searchParams.append("ids", subjectIds.join(","));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Wanikani-Revision": "20170710",
        },
      });
      console.debug(`Response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`Error fetching subjects: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data as APISubject[];
    }
  }

  export type APISubject = {
    id: number;
    object: string;
    url: string;
    data_updated_at: string;
    data: {
      created_at: string;
      level: number;
      slug: string;
      hidden_at: string | null;
      document_url: string;
      characters: string;
      meanings: {
        meaning: string;
        primary: boolean;
        accepted_answer: boolean;
      }[];
      readings: {
        type: string;
        primary: boolean;
        accepted_answer: boolean;
        reading: string;
      }[];
      component_subject_ids: number[];
      amalgamation_subject_ids: number[];
      visually_similar_subject_ids: number[];
      meaning_mnemonic: string;
      meaning_hint?: string;
      reading_mnemonic: string;
      reading_hint?: string;
      lesson_position: number;
      spaced_repetition_system_id: number;
    };
  };

  // function trim(strings: TemplateStringsArray, ...values: any[]): string {
  //   // Join the template strings and interpolate any values
  //   let result = strings.reduce(
  //     (acc, str, i) => acc + str + (values[i] ?? ""),
  //     ""
  //   );

  //   // Trim whitespace from the final result
  //   return result.trim();
  // }

  function htmlToElement(html: string): Element {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    const result = template.content.firstElementChild;
    if (result == null) {
      throw new Error("No element found in template");
    }
    return result;
  }

  /**
   * Splits an array into chunks of a specified size.
   *
   * @param array - The array to split into chunks.
   * @param size - The size of each chunk.
   * @returns An array of arrays, where each inner array is a chunk of the original array.
   */
  function chunk<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }
}

AddMeaning.main();
