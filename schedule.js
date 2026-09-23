const SCHEDULE_API_URL = "https://justbaila-inner-circle-api.justbaila-inner-circle.workers.dev/api/public/schedule";
const scheduleList = document.querySelector("#schedule-list");

if (scheduleList) loadSchedule();

async function loadSchedule() {
  try {
    const response = await fetch(SCHEDULE_API_URL, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("Schedule unavailable");
    const result = await response.json();
    if (!Array.isArray(result.entries)) throw new Error("Invalid schedule");
    renderSchedule(result.entries);
  } catch {
    // Keep the static schedule already in the page as a production fallback.
  }
}

function renderSchedule(entries) {
  const language = scheduleList.dataset.language === "es" ? "es" : "en";
  const dayNames = language === "es"
    ? { monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles", thursday: "Jueves", friday: "Viernes", saturday: "Sábado", sunday: "Domingo" }
    : { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday" };
  const labels = language === "es"
    ? { className: "Clase", time: "Hora", level: "Nivel", location: "Ubicación", empty: "No hay clases programadas actualmente." }
    : { className: "Class", time: "Time", level: "Level", location: "Location", empty: "No classes are currently scheduled." };
  const grouped = new Map();
  entries.forEach((entry) => {
    if (!grouped.has(entry.dayKey)) grouped.set(entry.dayKey, []);
    grouped.get(entry.dayKey).push(entry);
  });

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "section-subtitle";
    empty.textContent = labels.empty;
    scheduleList.replaceChildren(empty);
    return;
  }

  scheduleList.replaceChildren(...Array.from(grouped, ([dayKey, dayEntries]) => {
    const dayCard = document.createElement("article");
    dayCard.className = "schedule-day-card";
    const heading = document.createElement("h3");
    heading.className = "schedule-day-title";
    heading.textContent = dayNames[dayKey] || dayKey;
    const classes = document.createElement("div");
    classes.className = "schedule-classes";
    classes.replaceChildren(...dayEntries.map((entry) => makeClassRow(entry, language, labels)));
    dayCard.append(heading, classes);
    return dayCard;
  }));
}

function makeClassRow(entry, language, labels) {
  const row = document.createElement("article");
  row.className = "schedule-class-row";
  const meta = document.createElement("div");
  meta.className = "schedule-class-meta";
  meta.append(
    makeScheduleField(labels.className, language === "es" ? entry.classNameEs : entry.classNameEn),
    makeScheduleField(labels.time, entry.timeText),
    makeScheduleField(labels.level, language === "es" ? entry.levelEs : entry.levelEn),
    makeScheduleField(labels.location, language === "es" ? entry.locationEs : entry.locationEn)
  );
  row.append(meta);
  if (entry.linkUrl) {
    const link = document.createElement("a");
    link.className = "schedule-link";
    link.href = entry.linkUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = language === "es" ? entry.linkLabelEs : entry.linkLabelEn;
    row.append(link);
  }
  return row;
}

function makeScheduleField(labelText, value) {
  const paragraph = document.createElement("p");
  const label = document.createElement("span");
  label.className = "schedule-label";
  label.textContent = labelText;
  const content = document.createElement("span");
  content.className = "schedule-value";
  content.textContent = value;
  paragraph.append(label, content);
  return paragraph;
}
