import Whispers from "@/bot/whispers";
import { echoWhisper } from "./echo";
import { rpsWhisper } from "./rps";

export const whispers: Whispers[] = [echoWhisper, rpsWhisper];
