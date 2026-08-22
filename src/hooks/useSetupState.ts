import { useCallback, useEffect, useMemo, useState } from "react";
import { dateNightAvailability, dateNightThemeTags } from "../date-night";
import { levels } from "../game-data";
import type { PlayMode, SetupState } from "../types";

const LOCAL_MODES = ["conversation", "classic", "date_night"];

function initialSetup(invitedCode: string): SetupState {
  return {
    playMode: invitedCode ? "join" : "local",
    roomMode: "conversation",
    audience: "couple",
    playerNames: "",
    hostName: "",
    cardsPerLevel: 6,
    selectedThemeTags: [],
    includeSpicy: false,
    dateVariant: "classic",
    agreement: false,
    joinCode: invitedCode,
    joinName: "",
    joinAgreement: false
  };
}

export function useSetupState(invitedCode: string) {
  const [setup, setSetup] = useState<SetupState>(() => initialSetup(invitedCode));

  const update = useCallback((patch: Partial<SetupState>) => {
    setSetup((current) => ({ ...current, ...patch }));
  }, []);

  // Only the experiences that a single phone can run are offered without a room.
  const choosePlayMode = useCallback((playMode: PlayMode) => {
    setSetup((current) => ({
      ...current,
      playMode,
      roomMode: playMode === "local" && !LOCAL_MODES.includes(current.roomMode)
        ? "conversation"
        : current.roomMode
    }));
  }, []);

  const toggleThemeTag = useCallback((tag: string) => {
    setSetup((current) => ({
      ...current,
      selectedThemeTags: current.selectedThemeTags.includes(tag)
        ? current.selectedThemeTags.filter((item) => item !== tag)
        : [...current.selectedThemeTags, tag]
    }));
  }, []);

  const dateNightTags = useMemo(() => dateNightThemeTags(setup.includeSpicy), [setup.includeSpicy]);
  const dateNightCounts = useMemo(
    () => dateNightAvailability(setup.selectedThemeTags, setup.includeSpicy),
    [setup.includeSpicy, setup.selectedThemeTags]
  );
  const dateNightFiltersValid = levels.every((level) => (dateNightCounts[level.id] || 0) >= 2);

  // Turning spicy prompts off can retire a theme that was selected while they were on.
  useEffect(() => {
    setSetup((current) => {
      const kept = current.selectedThemeTags.filter((tag) => dateNightTags.includes(tag));
      return kept.length === current.selectedThemeTags.length ? current : { ...current, selectedThemeTags: kept };
    });
  }, [dateNightTags]);

  return {
    setup,
    update,
    choosePlayMode,
    toggleThemeTag,
    dateNightTags,
    dateNightCounts,
    dateNightFiltersValid
  };
}
