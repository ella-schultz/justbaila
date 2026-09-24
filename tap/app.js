const CARD_ID_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$/;
const API_BASE_URL = "https://justbaila-inner-circle-api.justbaila-inner-circle.workers.dev";
const cardId = new URLSearchParams(window.location.search).get("id")?.trim().toUpperCase() || "";
let currentUndergroundLevel = null;

const states = {
  loading: document.querySelector("#loading-state"),
  invalid: document.querySelector("#invalid-state"),
  error: document.querySelector("#error-state"),
  claim: document.querySelector("#claim-state"),
  passport: document.querySelector("#passport-state")
};

const accessLabel = document.querySelector("#access-label");
const accessSeal = document.querySelector("#access-seal");
const gatedContent = document.querySelectorAll(".gated-content");
const claimForm = document.querySelector("#claim-form");
const claimMessage = document.querySelector("#claim-message");
const retryButton = document.querySelector("#retry-button");
const eventCheckinForm = document.querySelector("#event-checkin-form");
const eventCheckinSection = document.querySelector(".event-checkin");
const signalsSection = document.querySelector(".signals-section");
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

  showState("loading", "Following the signal");
  try {
    const response = await fetch(`${API_BASE_URL}/api/card/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId })
    });
    const result = await response.json();

    if (result.status === "unclaimed") {
      showState("claim", "Access detected");
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
    showState("error", "Signal lost");
  }
}

async function claimPassport(event) {
  event.preventDefault();
  claimMessage.textContent = "";
  const submitButton = claimForm.querySelector("button[type='submit']");
  const memberName = new FormData(claimForm).get("memberName")?.toString().trim() || "";
  submitButton.disabled = true;
  submitButton.textContent = "Opening access…";

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
    claimMessage.textContent = result.error || "We couldn’t grant access. Please try again.";
  } catch {
    claimMessage.textContent = "The service is temporarily unavailable. Please try again.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enter the Underground";
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
  const previousLevel = currentUndergroundLevel;
  currentUndergroundLevel = passport.undergroundLevel;
  document.querySelector("#passport-name").textContent = passport.memberName;
  document.querySelector("#underground-level").textContent = passport.undergroundLevel;
  document.querySelector("#passport-card-number").textContent = passport.cardNumber;
  document.querySelector("#passport-activation-date").textContent = formatDate(passport.activationDate);
  document.querySelector("#passport-monogram").textContent = getInitials(passport.memberName);
  document.querySelector("#attendance-count").textContent = passport.attendanceCount;
  document.querySelector("#milestone-count").textContent = passport.milestoneCount;
  document.querySelector("#mission-count").textContent = passport.missionCount;
  document.querySelector("#key-count").textContent = passport.keyBalance;
  document.querySelector("#member-relay-code").textContent = passport.relayCode || "------";
  const privateAssignment = (passport.missions || []).find((mission) => mission.privateAssignment && mission.assignmentStatus === "active" && !mission.completed);
  renderSignals(passport.signals || []);
  renderInvitation(passport.invitation);
  renderRewards(passport.rewards || [], passport.keyBalance);
  renderMilestones(passport.milestones || []);
  renderMissions(passport.missions || []);
  showState("passport", "Access granted");
  accessSeal.hidden = !privateAssignment;
  accessSeal.href = "#private-assignment";
  accessSeal.classList.toggle("has-private-assignment", Boolean(privateAssignment));
  accessLabel.textContent = "Private assignment";
  eventCheckinSection.hidden = !passport.socialCheckinVisible;
  signalsSection.hidden = !(passport.signalsVisible && (passport.signals || []).length > 0);
  if (previousLevel && previousLevel !== passport.undergroundLevel) showLevelUpdate(previousLevel, passport.undergroundLevel);
  else showKeyAward(passport.latestKeyTransaction);
}

function showLevelUpdate(previousLevel, nextLevel) {
  const award = document.querySelector("#key-award");
  award.textContent = `LEVEL UPDATED // ${previousLevel} → ${nextLevel}`;
  award.hidden = false;
  window.setTimeout(() => award.classList.add("is-visible"), 50);
  window.setTimeout(() => {
    award.classList.remove("is-visible");
    window.setTimeout(() => { award.hidden = true; }, 500);
  }, 5000);
}

function renderSignals(signals) {
  const grid = document.querySelector("#signals-grid");
  grid.replaceChildren(...signals.map((signal) => {
    const article = document.createElement("article");
    article.className = "signal-card";
    article.innerHTML = `<p class="signal-status">Signal received</p><h3></h3><p>It doesn't stay anywhere for long.</p>`;
    article.querySelector("h3").textContent = signal.title;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "member-button signal-relay-start";
    button.textContent = "Relay the Signal";
    const form = document.createElement("form");
    form.className = "signal-relay-form";
    form.hidden = true;
    form.innerHTML = `<label>Recipient's relay code<input name="relayCode" minlength="6" maxlength="6" autocomplete="off" inputmode="text" required /></label><button class="member-button" type="submit">Find member</button><p class="form-message" aria-live="polite"></p>`;
    button.addEventListener("click", () => { button.hidden = true; form.hidden = false; form.querySelector("input").focus(); });
    form.addEventListener("submit", (event) => resolveRecipient(event, signal, article));
    article.append(button, form);
    return article;
  }));
}

async function resolveRecipient(event, signal, article) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const message = form.querySelector(".form-message");
  const relayCode = new FormData(form).get("relayCode")?.toString().trim().toUpperCase() || "";
  button.disabled = true;
  button.textContent = "Checking…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/signals/recipient`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, signalCode: signal.code, relayCode }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "That member could not be found.");
    form.hidden = true;
    const confirmation = document.createElement("div");
    confirmation.className = "signal-confirmation";
    const text = document.createElement("p");
    text.textContent = `Relay to ${result.recipient.name}?`;
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "member-button";
    confirm.textContent = "Confirm relay";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "signal-cancel";
    cancel.textContent = "Not this person";
    confirm.addEventListener("click", () => confirmRelay(signal, relayCode, confirm, confirmation));
    cancel.addEventListener("click", () => { confirmation.remove(); form.hidden = false; button.disabled = false; button.textContent = "Find member"; });
    confirmation.append(text, confirm, cancel);
    article.append(confirmation);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = "Find member";
  }
}

async function confirmRelay(signal, relayCode, button, container) {
  button.disabled = true;
  button.textContent = "Relaying…";
  try {
    const response = await fetch(`${API_BASE_URL}/api/signals/relay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, signalCode: signal.code, relayCode, idempotencyKey: crypto.randomUUID().replaceAll("-", "") }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The Signal could not be relayed.");
    renderPassport(result.passport);
    showSignalNotice();
  } catch (error) {
    container.querySelector("p").textContent = error.message;
    button.disabled = false;
    button.textContent = "Try again";
  }
}

function showSignalNotice() {
  const award = document.querySelector("#key-award");
  award.textContent = "SIGNAL RELAYED // Someone else is carrying it now.";
  award.hidden = false;
  requestAnimationFrame(() => award.classList.add("is-visible"));
  window.setTimeout(() => { award.classList.remove("is-visible"); window.setTimeout(() => { award.hidden = true; }, 450); }, 4200);
}

function renderRewards(rewards, keyBalance) {
  const grid = document.querySelector("#rewards-grid");
  grid.replaceChildren(...rewards.map((reward) => {
    const article = document.createElement("article");
    const affordable = keyBalance >= reward.keyCost;
    article.className = `reward-card${affordable ? " reward-unlocked" : ""}${reward.pending ? " reward-pending" : ""}`;
    const cost = document.createElement("p");
    cost.className = "reward-cost";
    cost.textContent = `${reward.keyCost} Keys`;
    const title = document.createElement("h3");
    title.textContent = reward.title;
    const description = document.createElement("p");
    description.textContent = reward.description;
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = !affordable || reward.pending;
    button.textContent = reward.pending ? "Redemption pending" : affordable ? "Redeem reward" : `${reward.keyCost - keyBalance} more Keys`;
    const message = document.createElement("p");
    message.className = "form-message";
    if (reward.pending) message.textContent = "Find a JustBaila team member to claim your reward.";
    button.addEventListener("click", () => redeemReward(reward, button, message));
    article.append(cost, title, description, button, message);
    return article;
  }));
}

async function redeemReward(reward, button, message) {
  if (!window.confirm(`Redeem ${reward.keyCost} Keys for “${reward.title}”?`)) return;
  button.disabled = true;
  button.textContent = "Redeeming…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/rewards/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, rewardCode: reward.code, idempotencyKey: crypto.randomUUID().replaceAll("-", "") })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn’t redeem this reward.");
    renderPassport(result.passport);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = "Redeem reward";
  }
}

function renderInvitation(invitation) {
  if (!invitation) return;
  document.querySelector("#invitation-kicker").textContent = invitation.kicker;
  document.querySelector("#invitation-title").textContent = invitation.title;
  document.querySelector("#invitation-description").textContent = invitation.description;
  const link = document.querySelector("#invitation-link");
  const buttonLabel = invitation.buttonLabel?.trim() || "";
  const buttonUrl = invitation.buttonUrl?.trim() || "";
  link.hidden = !(buttonLabel && buttonUrl);
  if (!link.hidden) {
    link.textContent = buttonLabel;
    link.href = buttonUrl;
  } else {
    link.textContent = "";
    link.removeAttribute("href");
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
    status.textContent = milestone.achieved ? "Achieved" : milestone.claimableByCode ? "Code required" : milestone.memberClaimable ? "Honor claim" : "Locked";
    const title = document.createElement("h3");
    title.textContent = milestone.title;
    const description = document.createElement("p");
    description.className = "milestone-description";
    description.textContent = milestone.description;
    article.append(seal, status, title, description);
    if (milestone.memberClaimable && !milestone.claimableByCode && !milestone.achieved) {
      const button = document.createElement("button");
      button.className = "milestone-claim-button";
      button.type = "button";
      button.textContent = "Claim milestone";
      const message = document.createElement("p");
      message.className = "form-message";
      button.addEventListener("click", () => claimMilestoneDirect(milestone, button, message));
      article.append(button, message);
    }
    return article;
  }));
}

async function claimMilestoneDirect(milestone, button, message) {
  button.disabled = true;
  button.textContent = "Claiming…";
  message.textContent = "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/milestones/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, milestoneCode: milestone.code })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn’t claim this milestone.");
    renderPassport(result.passport);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = "Claim milestone";
  }
}

function renderMissions(missions) {
  const grid = document.querySelector("#missions-grid");
  let privateAnchorAssigned = false;
  grid.replaceChildren(...missions.map((mission, index) => {
    const article = document.createElement("article");
    article.className = `mission-card${mission.completed ? " mission-completed" : ""}${mission.privateAssignment ? " mission-private" : ""}`;
    if (mission.privateAssignment && mission.assignmentStatus === "active" && !privateAnchorAssigned) {
      article.id = "private-assignment";
      privateAnchorAssigned = true;
    }

    const meta = document.createElement("div");
    meta.className = "mission-meta";
    const number = document.createElement("span");
    number.textContent = mission.privateAssignment ? "Private assignment" : `Mission ${String(index + 1).padStart(2, "0")}`;
    const status = document.createElement("span");
    status.className = "mission-status";
    status.textContent = mission.completed ? "Completed" : "Active";
    meta.append(number, status);

    const title = document.createElement("h3");
    title.textContent = mission.title;
    if (mission.privateAssignment && !mission.completed) {
      const privateCopy = document.createElement("p");
      privateCopy.className = "private-assignment-copy";
      privateCopy.textContent = "This one is for you.";
      article.append(meta, privateCopy, title);
    } else {
      article.append(meta, title);
    }
    const description = document.createElement("p");
    description.textContent = mission.description;
    const reward = document.createElement("p");
    reward.className = "mission-reward";
    reward.textContent = mission.completed
      ? `+${mission.keysEarned} ${mission.keysEarned === 1 ? "KEY" : "KEYS"} EARNED`
      : `${mission.keyReward} ${mission.keyReward === 1 ? "KEY" : "KEYS"}`;
    article.append(description, reward);
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
  accessSeal.hidden = true;
  accessSeal.classList.remove("has-private-assignment");
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
