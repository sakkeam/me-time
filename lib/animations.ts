export type AnimationCategory = 
  | "greetings" 
  | "hand_gestures" 
  | "actions" 
  | "emotions" 
  | "running" 
  | "poses" 
  | "idle";

export interface AnimationDefinition {
  file: string;
  name: string;
  category: AnimationCategory;
  tags: string[];
  description: string;
  loop?: boolean;
}

export const ANIMATION_REGISTRY: Record<string, AnimationDefinition> = {
  // Idle
  idle: { file: "CQ_IDLE.vrma", name: "idle", category: "idle", tags: ["idle", "standing"], description: "Default standing idle pose", loop: true },
  
  // Greetings
  hello_wave: { file: "004_hello_1.vrma", name: "hello_wave", category: "greetings", tags: ["hello", "wave", "greeting"], description: "Waving hello" },
  bow: { file: "002_dogeza.vrma", name: "bow", category: "greetings", tags: ["bow", "apology", "respect"], description: "Deep bow (dogeza)" },
  
  // Hand Gestures
  peace: { file: "peace_30ko.vrma", name: "peace", category: "hand_gestures", tags: ["peace", "victory", "v_sign"], description: "Peace sign" },
  thumbs_up: { file: "thumsup_30ko.vrma", name: "thumbs_up", category: "hand_gestures", tags: ["thumbs_up", "good", "approve"], description: "Thumbs up gesture" },
  heart: { file: "Heart_30ko.vrma", name: "heart", category: "hand_gestures", tags: ["heart", "love", "cute"], description: "Heart shape with hands" },
  point: { file: "point_30ko.vrma", name: "point", category: "hand_gestures", tags: ["point", "look"], description: "Pointing finger" },
  rock_n_roll: { file: "rock'n'roll_30ko.vrma", name: "rock_n_roll", category: "hand_gestures", tags: ["rock", "cool"], description: "Rock 'n' roll sign" },
  fox_sign: { file: "Kitsune_30ko.vrma", name: "fox_sign", category: "hand_gestures", tags: ["fox", "kitsune"], description: "Fox hand sign" },
  fist: { file: "fist_30ko.vrma", name: "fist", category: "hand_gestures", tags: ["fist", "strength"], description: "Clenched fist" },
  open_hand: { file: "open_30ko.vrma", name: "open_hand", category: "hand_gestures", tags: ["open", "hand"], description: "Open hand" },
  gao: { file: "Gao_30ko.vrma", name: "gao", category: "hand_gestures", tags: ["claw", "monster", "gao"], description: "Claw/Monster pose" },
  
  // Actions
  drink_water: { file: "006_drinkwater.vrma", name: "drink_water", category: "actions", tags: ["drink", "water"], description: "Drinking water" },
  smartphone: { file: "005_smartphone.vrma", name: "smartphone", category: "actions", tags: ["phone", "mobile"], description: "Using a smartphone" },
  step: { file: "003_humidai.vrma", name: "step", category: "actions", tags: ["step", "up"], description: "Stepping up" },
  shock: { file: "008_gatan.vrma", name: "shock", category: "actions", tags: ["shock", "collapse", "gatan"], description: "Shock/Collapse" },
  
  // Emotions
  excited: { file: "007_gekirei.vrma", name: "excited", category: "emotions", tags: ["excited", "encourage", "happy"], description: "Excited encouragement" },
  fidgeting: { file: "Jitabata.vrma", name: "fidgeting", category: "emotions", tags: ["fidget", "tantrum", "restless"], description: "Fidgeting or tantrum" },
  
  // Running
  run_ninja: { file: "Run_Ninja_30ko.vrma", name: "run_ninja", category: "running", tags: ["run", "ninja"], description: "Ninja run", loop: true },
  run_athlete: { file: "Run_Athlete_30ko.vrma", name: "run_athlete", category: "running", tags: ["run", "athlete"], description: "Athletic run", loop: true },
  
  // Poses
  sitting_idle: { file: "CQ_SittingIDLE.vrma", name: "sitting_idle", category: "poses", tags: ["sit", "idle"], description: "Sitting idle", loop: true },
  prone_idle: { file: "CQ_ProneIDLE.vrma", name: "prone_idle", category: "poses", tags: ["prone", "sleep"], description: "Lying prone idle", loop: true },
  pose_1: { file: "001_motion_pose.vrma", name: "pose_1", category: "poses", tags: ["pose"], description: "Generic pose 1", loop: true },
  pose_2: { file: "pose_30ko.vrma", name: "pose_2", category: "poses", tags: ["pose"], description: "Generic pose 2", loop: true },
};
