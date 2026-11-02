/**
 * limits.js -- one place that stops the screens from adding more than the app can keep.
 *
 * Why this exists: schema.js trims every save to a maximum size when it is loaded (see the
 * MAX_* numbers there). If a screen let you add one more than that, it would look fine until
 * the next reload, and then the extra item would silently disappear. So every "Add" button
 * asks canAdd() first and shows a message instead of adding.
 */
import { toast } from "./toast.js";

/**
 * canAdd(current, max, "components") -> true if there is still room.
 * When full it shows a toast such as "You've reached the limit of 20 components." and returns false.
 */
export function canAdd(current, max, what) {
  if (current < max) return true;
  toast(`You've reached the limit of ${max} ${what}.`, "warn");
  return false;
}
