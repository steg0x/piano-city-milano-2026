(function () {
  const source = window.PCM_DATA || { events: [] };
  const events = source.events.map(normalizeEvent);
  const savedKey = "pcmSavedEvents";
  const saved = new Set(readSaved());
  const state = {
    query: "",
    day: "all",
    venues: new Set(),
    venueListOpen: false,
    priority: "all",
    musicType: "all",
    genre: "all",
    type: "all",
    author: "all",
    dayPart: "all",
    gamOnly: false,
    bookingOnly: false,
    savedOnly: false,
    sort: "priority",
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    populateFilters();
    bindEvents();
    renderStats();
    renderSpotlight();
    render();
  }

  function cacheElements() {
    [
      "searchInput",
      "dayButtons",
      "venueSearch",
      "selectedVenues",
      "toggleVenueList",
      "venueChecklist",
      "quickVenueButtons",
      "toggleFilters",
      "filtersBody",
      "priorityFilter",
      "musicTypeFilter",
      "genreFilter",
      "typeFilter",
      "authorFilter",
      "dayPartFilter",
      "gamOnlyFilter",
      "bookingOnlyFilter",
      "savedOnlyFilter",
      "sortFilter",
      "eventsList",
      "plannerList",
      "resultCount",
      "spotlightGrid",
      "statTotal",
      "statMust",
      "statGam",
      "statBooking",
      "statVenues",
      "resetFilters",
      "resetFiltersTop",
      "clearSaved",
      "jumpToResults",
      "backToTop",
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function populateFilters() {
    const days = unique(events.map((event) => event.dayNumber))
      .sort((a, b) => a - b)
      .map((day) => {
        const sample = events.find((event) => event.dayNumber === day);
        return {
          value: String(day),
          label: `${sample.dayName || day} ${day}`,
        };
      });

    els.dayButtons.innerHTML = [
      `<button class="day-chip active" type="button" data-day="all">Tutti</button>`,
      ...days.map(
        (day) =>
          `<button class="day-chip" type="button" data-day="${escapeHtml(day.value)}">${escapeHtml(day.label)}</button>`
      ),
    ].join("");

    fillSelect(
      els.musicTypeFilter,
      "Tutte",
      unique(events.map((event) => event.musicType)).sort(localeSort)
    );

    fillSelect(
      els.genreFilter,
      "Tutti",
      unique(events.flatMap((event) => event.genres)).sort(localeSort)
    );

    renderVenueChecklist();
    renderQuickVenueButtons();

    fillCountSelect(
      els.typeFilter,
      "Tutte le tipologie",
      countValues(events.flatMap((event) => event.types))
    );

    fillCountSelect(
      els.authorFilter,
      "Tutti gli autori",
      countValues(events.flatMap((event) => event.authors))
    );
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      render();
    });

    els.dayButtons.addEventListener("click", (event) => {
      const button = event.target.closest("[data-day]");
      if (!button) return;
      state.day = button.dataset.day;
      document.querySelectorAll(".day-chip").forEach((chip) => chip.classList.remove("active"));
      button.classList.add("active");
      render();
    });

    [
      ["priorityFilter", "priority"],
      ["musicTypeFilter", "musicType"],
      ["genreFilter", "genre"],
      ["typeFilter", "type"],
      ["authorFilter", "author"],
      ["dayPartFilter", "dayPart"],
      ["sortFilter", "sort"],
    ].forEach(([elementId, stateKey]) => {
      els[elementId].addEventListener("change", (event) => {
        state[stateKey] = event.target.value;
        render();
      });
    });

    els.venueSearch.addEventListener("input", renderVenueChecklist);

    els.toggleVenueList.addEventListener("click", () => {
      state.venueListOpen = !state.venueListOpen;
      renderVenueListState();
    });

    els.venueChecklist.addEventListener("change", (event) => {
      const input = event.target.closest("[data-venue-checkbox]");
      if (!input) return;
      if (input.checked) {
        state.venues.add(input.value);
      } else {
        state.venues.delete(input.value);
      }
      render();
    });

    els.selectedVenues.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-venue]");
      if (!button) return;
      state.venues.delete(button.dataset.removeVenue);
      syncVenueInputs();
      render();
    });

    [
      ["gamOnlyFilter", "gamOnly"],
      ["bookingOnlyFilter", "bookingOnly"],
      ["savedOnlyFilter", "savedOnly"],
    ].forEach(([elementId, stateKey]) => {
      els[elementId].addEventListener("change", (event) => {
        state[stateKey] = event.target.checked;
        render();
      });
    });

    els.resetFilters.addEventListener("click", resetFilters);
    els.resetFiltersTop.addEventListener("click", resetFilters);
    els.toggleFilters.addEventListener("click", toggleFiltersPanel);
    els.jumpToResults.addEventListener("click", () => {
      setMobileFiltersOpen(false);
      document.getElementById("resultsTitle").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    els.backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.querySelector('.mobile-jumpbar a[href="#filtersTitle"]').addEventListener("click", () => {
      setMobileFiltersOpen(true);
    });
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    window.addEventListener("resize", () => {
      if (!isMobileView()) {
        setMobileFiltersOpen(true);
      }
    });
    els.clearSaved.addEventListener("click", () => {
      saved.clear();
      persistSaved();
      render();
    });

    document.addEventListener(
      "wheel",
      (event) => {
        const panel = event.target.closest(".filters-panel");
        if (!panel) return;

        const venueList = event.target.closest(".venue-checklist.open");
        const scrollTarget =
          venueList && canScrollWithDelta(venueList, event.deltaY)
            ? venueList
            : panel;
        const pageX = window.scrollX;
        const pageY = window.scrollY;
        const maxScroll = scrollTarget.scrollHeight - scrollTarget.clientHeight;
        event.preventDefault();
        event.stopPropagation();

        if (maxScroll > 0) {
          scrollTarget.scrollTop = Math.max(0, Math.min(maxScroll, scrollTarget.scrollTop + event.deltaY));
        }

        if (window.scrollX !== pageX || window.scrollY !== pageY) {
          window.scrollTo(pageX, pageY);
        }
        requestAnimationFrame(() => window.scrollTo(pageX, pageY));
      },
      { capture: true, passive: false }
    );

    els.quickVenueButtons.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-venue]");
      if (!chip) return;
      const venue = chip.dataset.venue;
      if (state.venues.has(venue)) {
        state.venues.delete(venue);
      } else {
        state.venues.add(venue);
      }
      syncVenueInputs();
      render();
    });

    document.addEventListener("click", (event) => {
      const saveButton = event.target.closest("[data-save-id]");
      if (!saveButton) return;
      const id = Number(saveButton.dataset.saveId);
      if (saved.has(id)) {
        saved.delete(id);
      } else {
        saved.add(id);
      }
      persistSaved();
      render();
    });

    setMobileFiltersOpen(!isMobileView());
    updateBackToTop();
  }

  function resetFilters() {
    Object.assign(state, {
      query: "",
      day: "all",
      venues: new Set(),
      venueListOpen: false,
      priority: "all",
      musicType: "all",
      genre: "all",
      type: "all",
      author: "all",
      dayPart: "all",
      gamOnly: false,
      bookingOnly: false,
      savedOnly: false,
      sort: "priority",
    });

    els.searchInput.value = "";
    els.venueSearch.value = "";
    renderVenueChecklist();
    renderVenueListState();
    syncVenueInputs();
    els.priorityFilter.value = "all";
    els.musicTypeFilter.value = "all";
    els.genreFilter.value = "all";
    els.typeFilter.value = "all";
    els.authorFilter.value = "all";
    els.dayPartFilter.value = "all";
    els.gamOnlyFilter.checked = false;
    els.bookingOnlyFilter.checked = false;
    els.savedOnlyFilter.checked = false;
    els.sortFilter.value = "priority";
    document.querySelectorAll(".day-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.day === "all");
    });
    render();
  }

  function toggleFiltersPanel() {
    const panel = els.toggleFilters.closest(".filters-panel");
    setMobileFiltersOpen(!panel.classList.contains("filters-open"));
  }

  function setMobileFiltersOpen(open) {
    const panel = els.toggleFilters.closest(".filters-panel");
    panel.classList.toggle("filters-open", open);
    els.toggleFilters.textContent = open ? "Chiudi" : "Apri";
    els.toggleFilters.setAttribute("aria-expanded", String(open));
    els.filtersBody.setAttribute("aria-hidden", String(!open && isMobileView()));
    updateBackToTop();
  }

  function updateBackToTop() {
    const filtersOpen = els.toggleFilters.closest(".filters-panel").classList.contains("filters-open");
    els.backToTop.classList.toggle("visible", window.scrollY > 520 && !filtersOpen);
  }

  function renderStats() {
    els.statTotal.textContent = String(events.length);
    els.statMust.textContent = String(events.filter((event) => event.priority === "Imperdibile").length);
    els.statGam.textContent = String(events.filter((event) => event.isGam || event.isPianoCenter).length);
    els.statBooking.textContent = String(events.filter((event) => event.bookingUrl).length);
    els.statVenues.textContent = String(unique(events.map((event) => event.venue)).length);
  }

  function renderSpotlight() {
    const topEvents = events
      .filter((event) => event.priority === "Imperdibile")
      .sort(comparePriority)
      .slice(0, 12);

    els.spotlightGrid.innerHTML = topEvents.map(renderSpotlightCard).join("");
  }

  function render() {
    const filtered = events.filter(matchesFilters).sort(getComparator());
    els.resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "risultato" : "risultati"} su ${events.length}`;
    els.eventsList.innerHTML = filtered.length
      ? filtered.map(renderEventCard).join("")
      : `<div class="empty-state">Nessun concerto trovato con questi filtri.</div>`;
    renderPlanner();
    updateQuickVenueButtons();
    renderSelectedVenues();
  }

  function renderPlanner() {
    const chosen = events
      .filter((event) => saved.has(event.id))
      .sort((a, b) => a.dayNumber - b.dayNumber || a.timeSort - b.timeSort || a.title.localeCompare(b.title));

    if (!chosen.length) {
      els.plannerList.innerHTML = `<div class="empty-state">Nessun concerto salvato.</div>`;
      return;
    }

    els.plannerList.innerHTML = chosen
      .map(
        (event) => `
          <div class="planner-item">
            <strong>${escapeHtml(event.title)}</strong>
            <span>${escapeHtml(formatDateTime(event))}</span>
            <span>${escapeHtml(event.venue)}</span>
          </div>
        `
      )
      .join("");
  }

  function matchesFilters(event, options = {}) {
    if (state.day !== "all" && String(event.dayNumber) !== state.day) return false;
    if (!options.ignoreVenue && state.venues.size > 0 && !state.venues.has(event.venue)) return false;
    if (state.priority !== "all" && event.priority !== state.priority) return false;
    if (state.musicType !== "all" && event.musicType !== state.musicType) return false;
    if (state.genre !== "all" && !event.genres.includes(state.genre)) return false;
    if (state.type !== "all" && !event.types.includes(state.type)) return false;
    if (state.author !== "all" && !event.authors.includes(state.author)) return false;
    if (state.dayPart !== "all" && event.dayPart !== state.dayPart) return false;
    if (state.gamOnly && !(event.isGam || event.isPianoCenter)) return false;
    if (state.bookingOnly && !event.bookingUrl) return false;
    if (state.savedOnly && !saved.has(event.id)) return false;
    if (state.query && !event.searchText.includes(state.query)) return false;
    return true;
  }

  function renderSpotlightCard(event) {
    return `
      <article class="spotlight-card">
        <div>
          <div class="tag-row">${renderTags(event, true)}</div>
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(formatDateTime(event))} · ${escapeHtml(event.venue)}</p>
          <p>${escapeHtml(event.why)}</p>
        </div>
        <div class="action-row">
          ${renderBookingButton(event)}
          <a class="link-button" href="${escapeAttribute(event.youtubeUrl)}" target="_blank" rel="noreferrer">YouTube</a>
          <a class="link-button" href="${escapeAttribute(event.spotifyUrl)}" target="_blank" rel="noreferrer">Spotify</a>
        </div>
      </article>
    `;
  }

  function renderEventCard(event) {
    const isSaved = saved.has(event.id);
    const subtitle = event.subtitle && event.subtitle !== event.title ? `<p class="event-meta">${escapeHtml(event.subtitle)}</p>` : "";
    const why = event.why ? `<p class="why">${escapeHtml(event.why)}</p>` : "";
    const authors = event.authors.length
      ? `<span class="tag">Autori: ${escapeHtml(event.authors.slice(0, 3).join(", "))}${event.authors.length > 3 ? "..." : ""}</span>`
      : "";

    return `
      <article class="event-card" data-event-id="${event.id}">
        <div class="time-block">
          <strong>${escapeHtml(event.time)}</strong>
          <span>${escapeHtml(event.dayLabel)}</span>
          <span>${escapeHtml(event.dayPart)}</span>
        </div>
        <div class="event-main">
          <div class="tag-row">${renderTags(event)}${authors}</div>
          <h3>${escapeHtml(event.title)}</h3>
          <p class="event-meta">${escapeHtml(event.artist)} · ${escapeHtml(event.venue)}${event.address ? ` · ${escapeHtml(event.address)}` : ""}</p>
          ${subtitle}
          ${why}
          <div class="action-row">
            ${renderBookingButton(event)}
            <a class="link-button" href="${escapeAttribute(event.officialUrl)}" target="_blank" rel="noreferrer">Scheda ufficiale</a>
            <a class="link-button" href="${escapeAttribute(event.mapsUrl)}" target="_blank" rel="noreferrer">Maps</a>
            <a class="link-button" href="${escapeAttribute(event.youtubeUrl)}" target="_blank" rel="noreferrer">YouTube</a>
            <a class="link-button" href="${escapeAttribute(event.spotifyUrl)}" target="_blank" rel="noreferrer">Spotify</a>
            <button class="save-button ${isSaved ? "saved" : ""}" type="button" data-save-id="${event.id}">
              ${isSaved ? "Salvato" : "Salva"}
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function renderTags(event, compact) {
    const priorityClass = event.priority.replace(/\s+/g, "-");
    const parts = [`<span class="tag priority-${escapeAttribute(priorityClass)}">${escapeHtml(event.priority)}</span>`];
    parts.push(`<span class="tag">${escapeHtml(event.musicType)}</span>`);
    if (event.isGam || event.isPianoCenter) parts.push(`<span class="tag gam">GAM / Piano Center</span>`);
    if (event.bookingUrl) parts.push(`<span class="tag">Prenotazione</span>`);
    if (!compact) {
      event.genres.slice(0, 3).forEach((genre) => parts.push(`<span class="tag">${escapeHtml(genre)}</span>`));
      event.types.slice(0, 2).forEach((type) => parts.push(`<span class="tag">${escapeHtml(type)}</span>`));
    }
    return parts.join("");
  }

  function renderBookingButton(event) {
    if (!event.bookingUrl) {
      return `<a class="link-button" href="${escapeAttribute(event.officialUrl)}" target="_blank" rel="noreferrer">Controlla accesso</a>`;
    }

    if (event.bookingOpensAt && Date.now() < new Date(event.bookingOpensAt).getTime()) {
      return `<span class="primary-button disabled">${escapeHtml(event.bookingNote || "Prenotazione non ancora aperta")}</span>`;
    }

    const label = event.bookingNote && event.bookingOpensAt ? "Prenota" : "Prenota";
    return `<a class="primary-button" href="${escapeAttribute(event.bookingUrl)}" target="_blank" rel="noreferrer">${label}</a>`;
  }

  function getComparator() {
    if (state.sort === "time") {
      return (a, b) => a.dayNumber - b.dayNumber || a.timeSort - b.timeSort || comparePriority(a, b);
    }

    if (state.sort === "venue") {
      return (a, b) =>
        a.venue.localeCompare(b.venue, "it") || a.dayNumber - b.dayNumber || a.timeSort - b.timeSort || comparePriority(a, b);
    }

    return comparePriority;
  }

  function comparePriority(a, b) {
    return a.rank - b.rank || a.dayNumber - b.dayNumber || a.timeSort - b.timeSort || a.title.localeCompare(b.title, "it");
  }

  function groupByVenue(sourceEvents) {
    const map = new Map();
    sourceEvents.forEach((event) => {
      if (!map.has(event.venue)) {
        map.set(event.venue, {
          venue: event.venue,
          count: 0,
          must: 0,
          booking: 0,
          isGam: false,
          bestRank: Number.POSITIVE_INFINITY,
          events: [],
        });
      }
      const group = map.get(event.venue);
      group.count += 1;
      group.must += event.priority === "Imperdibile" ? 1 : 0;
      group.booking += event.bookingUrl ? 1 : 0;
      group.isGam = group.isGam || event.isGam || event.isPianoCenter;
      group.bestRank = Math.min(group.bestRank, event.rank);
      group.events.push(event);
    });

    return [...map.values()]
      .map((group) => ({
        ...group,
        events: group.events.sort(comparePriority),
      }))
      .sort(
        (a, b) =>
          b.must - a.must ||
          Number(b.isGam) - Number(a.isGam) ||
          b.count - a.count ||
          a.bestRank - b.bestRank ||
      a.venue.localeCompare(b.venue, "it")
      );
  }

  function renderVenueChecklist() {
    const groups = groupByVenue(events);
    const query = (els.venueSearch?.value || "").trim().toLowerCase();
    const visibleGroups = query
      ? groups.filter((group) => group.venue.toLowerCase().includes(query))
      : groups;

    els.venueChecklist.innerHTML = visibleGroups
      .map((group) => {
        const details = [
          `${group.count} ${group.count === 1 ? "evento" : "eventi"}`,
          `${group.must} imperdibili`,
          group.booking ? `${group.booking} prenotabili` : "",
        ]
          .filter(Boolean)
          .join(", ");
        return `
          <label class="venue-option">
            <input
              type="checkbox"
              value="${escapeAttribute(group.venue)}"
              data-venue-checkbox
              ${state.venues.has(group.venue) ? "checked" : ""}
            >
            <span>
              <strong>${escapeHtml(group.venue)}</strong>
              <span>${escapeHtml(details)}</span>
            </span>
          </label>
        `;
      })
      .join("");
    syncVenueInputs();
  }

  function renderQuickVenueButtons() {
    const groups = groupByVenue(events).slice(0, 8);
    els.quickVenueButtons.innerHTML = groups
      .map(
        (group) => `
          <button class="quick-venue-chip" type="button" data-venue="${escapeAttribute(group.venue)}">
            ${escapeHtml(group.venue)} · ${group.count}${group.must ? ` / ${group.must} top` : ""}
          </button>
        `
      )
      .join("");
  }

  function updateQuickVenueButtons() {
    els.quickVenueButtons.querySelectorAll("[data-venue]").forEach((chip) => {
      chip.classList.toggle("active", state.venues.has(chip.dataset.venue));
    });
  }

  function syncVenueInputs() {
    els.venueChecklist.querySelectorAll("[data-venue-checkbox]").forEach((input) => {
      input.checked = state.venues.has(input.value);
    });
  }

  function renderSelectedVenues() {
    if (!state.venues.size) {
      els.selectedVenues.innerHTML = `<span class="field-help">Tutte le location selezionate</span>`;
      return;
    }

    els.selectedVenues.innerHTML = [...state.venues]
      .sort(localeSort)
      .map(
        (venue) => `
          <span class="selected-venue-chip">
            ${escapeHtml(venue)}
            <button type="button" data-remove-venue="${escapeAttribute(venue)}" aria-label="Rimuovi ${escapeAttribute(venue)}">x</button>
          </span>
        `
      )
      .join("");
  }

  function renderVenueListState() {
    els.venueChecklist.classList.toggle("open", state.venueListOpen);
    els.toggleVenueList.textContent = state.venueListOpen ? "Nascondi lista location" : "Mostra tutte le location";
    els.toggleVenueList.setAttribute("aria-expanded", String(state.venueListOpen));
  }

  function normalizeEvent(event) {
    const genres = arrayify(event.genres);
    const types = arrayify(event.types);
    const authors = arrayify(event.authors);
    const searchable = [
      event.title,
      event.artist,
      event.subtitle,
      event.dayLabel,
      event.time,
      event.venue,
      event.address,
      event.priority,
      event.musicType,
      event.why,
      ...genres,
      ...types,
      ...authors,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      ...event,
      genres,
      types,
      authors,
      title: event.title || event.artist || "Concerto",
      artist: event.artist || event.title || "Artista da verificare",
      venue: event.venue || "Luogo da verificare",
      address: event.address || "",
      priority: event.priority || "Tutti",
      rank: Number(event.rank || 200),
      dayNumber: Number(event.dayNumber || 99),
      timeSort: Number(event.timeSort || 9999),
      musicType: event.musicType || "Altro",
      searchText: searchable,
    };
  }

  function fillSelect(select, allLabel, values) {
    select.innerHTML = [
      `<option value="all">${escapeHtml(allLabel)}</option>`,
      ...values.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`),
    ].join("");
  }

  function fillCountSelect(select, allLabel, groups) {
    select.innerHTML = [
      `<option value="all">${escapeHtml(allLabel)}</option>`,
      ...groups.map(
        (group) =>
          `<option value="${escapeAttribute(group.value)}">${escapeHtml(group.value)} (${group.count})</option>`
      ),
    ].join("");
  }

  function countValues(values) {
    const map = new Map();
    values
      .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
      .forEach((value) => {
        const key = String(value).trim();
        map.set(key, (map.get(key) || 0) + 1);
      });
    return [...map.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "it"));
  }

  function formatDateTime(event) {
    return `${event.dayLabel} · ${event.time}`;
  }

  function unique(values) {
    return [...new Set(values.filter((value) => value !== undefined && value !== null && String(value).trim() !== ""))];
  }

  function arrayify(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (value === undefined || value === null || value === "") return [];
    return [String(value)];
  }

  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem(savedKey) || "[]");
    } catch {
      return [];
    }
  }

  function persistSaved() {
    localStorage.setItem(savedKey, JSON.stringify([...saved]));
  }

  function localeSort(a, b) {
    return String(a).localeCompare(String(b), "it");
  }

  function canScrollWithDelta(element, deltaY) {
    const maxScroll = element.scrollHeight - element.clientHeight;
    if (maxScroll <= 0) return false;
    if (deltaY < 0) return element.scrollTop > 0;
    if (deltaY > 0) return element.scrollTop < maxScroll;
    return false;
  }

  function isMobileView() {
    return window.matchMedia("(max-width: 820px)").matches;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
