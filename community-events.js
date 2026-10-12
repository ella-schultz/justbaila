const COMMUNITY_EVENTS_API_URL = "https://justbaila-inner-circle-api.justbaila-inner-circle.workers.dev/api/public/community-events";
const communityEventsSection = document.querySelector("#events");

if (communityEventsSection) loadCommunityEventsContent();

async function loadCommunityEventsContent() {
  try {
    const response = await fetch(COMMUNITY_EVENTS_API_URL, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json();
    renderCommunityEventsContent(result.content);
  } catch {}
}

function renderCommunityEventsContent(content) {
  const language = document.documentElement.lang === "es" ? "es" : "en";
  const copy = content?.[language];
  const fields = ["kicker", "title", "description", "nextTitle", "nextDescription", "outreachTitle", "outreachDescription", "buttonLabel"];
  if (!copy || fields.some(field => typeof copy[field] !== "string") || typeof content.calendarUrl !== "string") return;
  let calendarUrl = "";
  if (content.calendarUrl) {
    try {
      const url = new URL(content.calendarUrl);
      if (url.protocol !== "https:" || url.username || url.password) return;
      calendarUrl = url.href;
    } catch { return; }
  }
  for (const field of fields) {
    communityEventsSection.querySelector(`[data-community-field="${field}"]`).textContent = copy[field];
  }
  for (const block of ["next", "outreach"]) {
    communityEventsSection.querySelector(`[data-community-block="${block}"]`).hidden = !copy[`${block}Description`].trim();
  }
  const button = communityEventsSection.querySelector("[data-community-field='buttonLabel']");
  button.hidden = !(copy.buttonLabel.trim() && calendarUrl);
  if (button.hidden) button.removeAttribute("href");
  else button.href = calendarUrl;
}
