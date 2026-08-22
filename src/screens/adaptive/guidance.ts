import type { I18n } from "../../i18n-context";
import type { AdaptivePlayer, AdaptiveSession } from "../../types";

/** The one line under the meter that tells this viewer what the room is waiting for. */
export function adaptiveGuidance(
  session: AdaptiveSession,
  active: AdaptivePlayer | undefined,
  target: AdaptivePlayer | undefined,
  hasAction: (action: string) => boolean,
  t: I18n["t"]
) {
  if (session.mode === "classic") {
    if (session.phase === "classic_bonus_choice") return t("You completed the 36 questions. Continue if you want a looser bonus round.");
    if (session.phase === "classic_prompt") return t("Both partners answer aloud. Pass is always available.");
    return "";
  }
  if (session.mode === "date_night") {
    if (session.phase === "choose_milestone_reward") return t("Milestone reached. Choose a shared reward, then keep going.");
    if (session.phase === "choose_ending") return t("You reached your shared milestone. Either partner can choose how to close tonight.");
    if (session.phase === "choose_level") return hasAction("choose_level") ? t("Your turn to answer. Choose a depth that feels right.") : t("{name} is choosing a prompt to answer.", { name: active?.name || "" });
    return hasAction("complete") ? t("Share what feels true, then mark Completed. Passing is always welcome.") : t("{name} is answering this prompt.", { name: active?.name || "" });
  }
  if (session.mode === "icebreaker") {
    if (session.phase === "choose_level") return hasAction("choose_level") ? t("You are facilitating. Pick a friendly depth for the group.") : t("{name} is selecting a prompt level.", { name: active?.name || "" });
    if (session.phase === "spin_target") return hasAction("spin_target") ? t("The prompt is ready. Spin to fairly choose its responder.") : t("{name} is spinning for a responder.", { name: active?.name || "" });
    return hasAction("complete") ? t("Answer aloud, then mark Completed, or Pass with no explanation needed.") : t("{name} is responding for the group.", { name: target?.name || "" });
  }
  if (session.phase === "choose_level") return hasAction("choose_level") ? t("Your turn. Choose how deep to go and whether to risk your Double Down.") : t("{name} is choosing a challenge.", { name: active?.name || "" });
  if (["preview_card", "replacement_preview"].includes(session.phase)) {
    return hasAction("target_player")
      ? session.phase === "replacement_preview" ? t("Bailout respected. Choose a different player for this replacement prompt.") : t("Only you can see this card. Choose who receives it.")
      : t("{name} is selecting a player.", { name: active?.name || "" });
  }
  if (session.phase === "await_response") {
    if (session.currentChallenge?.claimant) return hasAction("complete") ? t("Answer the prompt, then confirm completion to claim its points.") : t("{name} chose to answer the passed prompt.", { name: active?.name || "" });
    return hasAction("complete") ? t("Answer aloud, then mark the prompt completed - or pass without explanation.") : t("{name} is responding.", { name: target?.name || "" });
  }
  if (session.phase === "await_claim") return hasAction("claim") ? t("The prompt was passed. Answer it yourself for base points or discard it.") : t("{name} may claim or discard the passed prompt.", { name: active?.name || "" });
  return "";
}
