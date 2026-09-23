const CARD_ID_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$/;
const API_BASE_URL = "https://justbaila-inner-circle-api.justbaila-inner-circle.workers.dev";
const cardId = new URLSearchParams(window.location.search).get("id")?.trim().toUpperCase() || "";

const states = {
  loading: document.querySelector("#loading-state"),
  invalid: document.querySelector("#invalid-state"),
  error: document.querySelector("#error-state"),
  claim: document.querySelector("#claim-state"),
  passport: document.querySelector("#passport-state")
};

const accessLabel = document.querySelector("#access-label");
const gatedContent = document.querySelectorAll(".gated-content");
const claimForm = document.querySelector("#claim-form");
const claimMessage = document.querySelector("#claim-message");
const retryButton = document.querySelector("#retry-button");
const eventCheckinForm = document.querySelector("#event-checkin-form");
const milestoneClaimForm = document.querySelector("#milestone-claim-form");

claimForm.addEventListener("submit", claimPassport);
retryButton.addEventListener("click", loadPassport);
eventCheckinForm.addEventListener("submit", checkInEvent);
milestoneClaimForm.addEventListener("submit", claimMilestone);
loadPassport();

async function loadPassport() {
  if (!CARD_ID_PATTERN.test(cardId)) {
    showState("invalid", "Card not recognized");
    return;
  }

  showState("loading", "Checking your card");
  try {
    const response = await fetch(`${API_BASE_URL}/api/card/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId })
    });
    const result = await response.json();

    if (result.status === "unclaimed") {
      showState("claim", "Invitation confirmed");
      return;
    }
    if (result.status === "claimed" && result.passport) {
      renderPassport(result.passport);
      return;
    }
    if (response.status === 400 || response.status === 404 || result.status === "invalid") {
      showState("invalid", "Card not recognized");
      return;
    }
    throw new Error(result.error || "The service is temporarily unavailable.");
  } catch (error) {
    document.querySelector("#error-message").textContent = error.message;
    showState("error", "Connection unavailable");
  }
}

async function claimPassport(event) {
  event.preventDefault();
  claimMessage.textContent = "";
  const submitButton = claimForm.querySelector("button[type='submit']");
  const memberName = new FormData(claimForm).get("memberName")?.toString().trim() || "";
  submitButton.disabled = true;
  submitButton.textContent = "Activating…";

  try {
    const response = await fetch(`${API_BASE_URL}/api/card/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, memberName })
    });
    const result = await response.json();
    if ((response.ok || response.status === 409) && result.status === "claimed" && result.passport) {
      renderPassport(result.passport);
      return;
    }
    if (response.status === 404 || result.status === "invalid") {
      showState("invalid", "Card not recognized");
      return;
    }
    claimMessage.textContent = result.error || "We couldn’t activate this passport. Please try again.";
  } catch {
    claimMessage.textContent = "The service is temporarily unavailable. Please try again.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Claim my passport";
  }
}

async function checkInEvent(event) {
  event.preventDefault();
  const button = eventCheckinForm.querySelector("button[type='submit']");
  const message = document.querySelector("#event-checkin-message");
  const checkInCode = new FormData(eventCheckinForm).get("checkInCode")?.toString() || "";
  button.disabled = true;
  button.textContent = "Checking in…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/events/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, checkInCode })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn’t check you in.");
    eventCheckinForm.reset();
    renderPassport(result.passport);
    message.textContent = `Checked in: ${result.eventTitle}`;
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Check in";
  }
}

async function claimMilestone(event) {
  event.preventDefault();
  const button = milestoneClaimForm.querySelector("button[type='submit']");
  const message = document.querySelector("#milestone-claim-message");
  const claimCode = new FormData(milestoneClaimForm).get("claimCode")?.toString() || "";
  button.disabled = true;
  button.textContent = "Claiming…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/milestones/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, claimCode })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn’t claim this milestone.");
    milestoneClaimForm.reset();
    renderPassport(result.passport);
    message.textContent = `Milestone achieved: ${result.milestoneTitle}`;
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Claim milestone";
  }
}

function renderPassport(passport) {
  document.querySelector("#passport-name").textContent = passport.memberName;
  document.querySelector("#passport-card-number").textContent = passport.cardNumber;
  document.querySelector("#passport-activation-date").textContent = formatDate(passport.activationDate);
  document.querySelector("#passport-monogram").textContent = getInitials(passport.memberName);
  document.querySelector("#attendance-count").textContent = passport.attendanceCount;
  document.querySelector("#milestone-count").textContent = passport.milestoneCount;
  document.querySelector("#mission-count").textContent = passport.missionCount;
  document.querySelector("#key-count").textContent = passport.keyBalance;
  renderInvitation(passport.invitation);
  renderMilestones(passport.milestones || []);
  renderMissions(passport.missions || []);
  showState("passport", "Access confirmed");
  showKeyAward(passport.latestKeyTransaction);
}

function renderInvitation(invitation) {
  if (!invitation) return;
  document.querySelector("#invitation-kicker").textContent = invitation.kicker;
  document.querySelector("#invitation-title").textContent = invitation.title;
  document.querySelector("#invitation-description").textContent = invitation.description;
  const link = document.querySelector("#invitation-link");
  link.hidden = !(invitation.buttonLabel && invitation.buttonUrl);
  if (!link.hidden) {
    link.textContent = invitation.buttonLabel;
    link.href = invitation.buttonUrl;
  }
}

function renderMilestones(milestones) {
  const grid = document.querySelector("#milestones-grid");
  grid.replaceChildren(...milestones.map((milestone) => {
    const article = document.createElement("article");
    article.className = `milestone-card${milestone.achieved ? " milestone-achieved" : ""}`;
    const seal = document.createElement("span");
    seal.className = "milestone-seal";
    seal.setAttribute("aria-hidden", "true");
    seal.textContent = milestone.achieved ? "✓" : "◇";
    const status = document.createElement("p");
    status.className = "milestone-status";
    status.textContent = milestone.achieved ? "Achieved" : "Locked";
    const title = document.createElement("h3");
    title.textContent = milestone.title;
    const description = document.createElement("p");
    description.textContent = milestone.description;
    article.append(seal, status, title, description);
    return article;
  }));
}

function renderMissions(missions) {
  const grid = document.querySelector("#missions-grid");
  grid.replaceChildren(...missions.map((mission, index) => {
    const article = document.createElement("article");
    article.className = `mission-card${mission.completed ? " mission-completed" : ""}`;

    const meta = document.createElement("div");
    meta.className = "mission-meta";
    const number = document.createElement("span");
    number.textContent = `Mission ${String(index + 1).padStart(2, "0")}`;
    const status = document.createElement("span");
    status.className = "mission-status";
    status.textContent = mission.completed ? "Completed" : "Active";
    meta.append(number, status);

    const title = document.createElement("h3");
    title.textContent = mission.title;
    const description = document.createElement("p");
    description.textContent = mission.description;
    const reward = document.createElement("p");
    reward.className = "mission-reward";
    reward.textContent = mission.completed
      ? `+${mission.keysEarned} ${mission.keysEarned === 1 ? "KEY" : "KEYS"} EARNED`
      : `${mission.keyReward} ${mission.keyReward === 1 ? "KEY" : "KEYS"}`;
    article.append(meta, title, description, reward);
    if (!mission.completed || mission.repeatable) article.append(makeClaimForm(mission));
    return article;
  }));
}

function makeClaimForm(mission) {
  const form = document.createElement("form");
  form.className = "mission-claim-form";
  if (mission.verificationRequired) {
    const label = document.createElement("label");
    label.textContent = "Mission code";
    const input = document.createElement("input");
    input.name = "verificationCode";
    input.type = "text";
    input.minLength = 4;
    input.maxLength = 40;
    input.autocomplete = "off";
    input.placeholder = "Enter your code";
    input.required = true;
    label.append(input);
    form.append(label);
  }
  const button = document.createElement("button");
  button.className = "mission-claim-button";
  button.type = "submit";
  button.textContent = mission.verificationRequired ? "Unlock Keys" : "Claim Keys";
  const message = document.createElement("p");
  message.className = "mission-claim-message";
  message.setAttribute("aria-live", "polite");
  form.append(button, message);
  form.addEventListener("submit", (event) => claimMission(event, mission));
  return form;
}

async function claimMission(event, mission) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const message = form.querySelector(".mission-claim-message");
  const verificationCode = new FormData(form).get("verificationCode")?.toString() || "";
  button.disabled = true;
  button.textContent = "Claiming…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/missions/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId,
        missionCode: mission.code,
        verificationCode,
        idempotencyKey: crypto.randomUUID().replaceAll("-", "")
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn’t claim this mission.");
    renderPassport(result.passport);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = mission.verificationRequired ? "Unlock Keys" : "Claim Keys";
  }
}

function showKeyAward(transaction) {
  if (!transaction || transaction.amount < 1) return;
  const storageKey = `justbaila-seen-key-transaction:${cardId}`;
  try {
    if (window.localStorage.getItem(storageKey) === transaction.id) return;
    window.localStorage.setItem(storageKey, transaction.id);
  } catch {}

  const award = document.querySelector("#key-award");
  award.textContent = `MISSION COMPLETE // +${transaction.amount} ${transaction.amount === 1 ? "KEY" : "KEYS"}`;
  award.hidden = false;
  window.setTimeout(() => award.classList.add("is-visible"), 50);
  window.setTimeout(() => {
    award.classList.remove("is-visible");
    window.setTimeout(() => { award.hidden = true; }, 500);
  }, 5000);
}

function showState(activeState, label) {
  Object.entries(states).forEach(([name, element]) => { element.hidden = name !== activeState; });
  gatedContent.forEach((section) => { section.hidden = activeState !== "passport"; });
  accessLabel.textContent = label;
}

function formatDate(value) {
  if (!value) return "today";
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function getInitials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}
