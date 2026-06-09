"""
hand_tracker.py
===============
Real-time hand tracking with your webcam.

What it does:
  * Opens your webcam with OpenCV.
  * Runs MediaPipe Hands (the simple "legacy" solutions API) on each frame.
  * Draws the 21 hand landmarks as RED dots and the skeleton connections as
    GREEN lines, overlaid on the live (mirrored) webcam feed.
  * Shows an FPS counter in the top-left corner.
  * Press 'q' to quit cleanly (releases the camera and closes the window).

Read it top to bottom — the whole pipeline is in one file with no extra layers.
"""

import time          # used to measure how long each frame takes -> FPS
import cv2           # OpenCV: webcam capture, drawing, and the display window
import mediapipe as mp   # MediaPipe: the actual hand-detection model


# ---------------------------------------------------------------------------
# 1. Set up the MediaPipe Hands "solution".
# ---------------------------------------------------------------------------
# We use the LEGACY solutions API: mediapipe.solutions.hands. It's the simple
# one — you create a Hands object and call .process() on each frame. (The newer
# "Tasks" API is more flexible but more verbose; we don't use it here.)
#
# mp_hands holds the model itself.
# mp_drawing is a helper that knows how to draw the dots and connecting lines.
# mp_drawing_styles gives ready-made colors/sizes, but we define our own below
# so we can guarantee RED dots and GREEN lines exactly as requested.
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

# Drawing specs. NOTE: OpenCV uses BGR color order, not RGB. So "red" is
# (0, 0, 255) and "green" is (0, 255, 0).
RED_DOT = mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=-1, circle_radius=4)
GREEN_LINE = mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2)


def main():
    # -----------------------------------------------------------------------
    # 2. Open the webcam.
    # -----------------------------------------------------------------------
    # Index 0 is the default camera. On a Windows Dell laptop that's normally
    # your built-in webcam. We pass cv2.CAP_DSHOW (DirectShow) because on
    # Windows it makes the camera open faster and more reliably.
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

    # If the camera can't be opened (in use by another app, blocked by privacy
    # settings, or simply not present), fail loudly with a clear message
    # instead of crashing on a blank frame later.
    if not cap.isOpened():
        print("ERROR: Could not open the webcam.")
        print("Things to check:")
        print("  - Is another app (Zoom, Teams, Camera) using the webcam? Close it.")
        print("  - Windows Settings > Privacy & security > Camera: allow apps.")
        print("  - If you have multiple cameras, try changing VideoCapture(0) to (1).")
        return

    # -----------------------------------------------------------------------
    # 3. Create the Hands detector.
    # -----------------------------------------------------------------------
    # Using a "with" block so the model is cleanly released when we're done.
    #   max_num_hands=2            -> track up to two hands.
    #   model_complexity=1         -> 1 = more accurate (0 = faster, less so).
    #   min_detection_confidence   -> how sure it must be to FIRST find a hand.
    #   min_tracking_confidence    -> how sure it must be to KEEP following it.
    with mp_hands.Hands(
        max_num_hands=2,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as hands:

        prev_time = time.time()  # timestamp of the previous frame, for FPS

        # -------------------------------------------------------------------
        # 4. Main loop: read a frame, process it, draw, and show it.
        # -------------------------------------------------------------------
        while True:
            # read() returns (success?, frame). 'frame' is a NumPy image array.
            ok, frame = cap.read()
            if not ok:
                # A failed read mid-stream usually means the camera dropped.
                print("ERROR: Failed to read a frame from the webcam. Exiting.")
                break

            # MIRROR the image (flip horizontally, code 1). Webcams show the
            # real world, so moving your hand right makes it go left on screen,
            # which feels backwards. Flipping makes it behave like a mirror —
            # move right, it moves right. Much more natural to interact with.
            frame = cv2.flip(frame, 1)

            # COLOR ORDER: OpenCV gives frames in BGR, but MediaPipe expects
            # RGB. If we skip this conversion the model still runs but on the
            # wrong colors, hurting accuracy. So convert BGR -> RGB before
            # processing, then draw on the original BGR frame for display.
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # PROCESS: this is where the model actually runs. It returns a
            # results object. The field we care about is:
            #   results.multi_hand_landmarks -> a list, one entry per detected
            #   hand. Each entry has 21 landmarks. Each landmark has .x, .y, .z
            #   as NORMALIZED coordinates (0.0 to 1.0) relative to the image,
            #   NOT pixels. If no hand is found, multi_hand_landmarks is None.
            #
            # (Optional speed tip: setting rgb.flags.writeable = False lets
            # MediaPipe avoid copying the image. We keep it simple here.)
            results = hands.process(rgb)

            # -------------------------------------------------------------
            # 5. Draw the landmarks and skeleton, if any hand was found.
            # -------------------------------------------------------------
            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    # draw_landmarks does the pixel math for us: it takes those
                    # normalized 0..1 coordinates and multiplies by the image
                    # width/height to get actual pixel positions, then draws
                    # red dots at each of the 21 points and green lines for the
                    # connections defined by HAND_CONNECTIONS (the skeleton).
                    mp_drawing.draw_landmarks(
                        frame,                       # draw onto the display frame
                        hand_landmarks,              # the 21 points for this hand
                        mp_hands.HAND_CONNECTIONS,   # which points to link up
                        RED_DOT,                     # landmark (dot) style
                        GREEN_LINE,                  # connection (line) style
                    )

            # -------------------------------------------------------------
            # 6. FPS counter (frames per second).
            # -------------------------------------------------------------
            # Measure how long this frame took, then fps = 1 / seconds.
            # We guard against divide-by-zero on an absurdly fast frame.
            now = time.time()
            elapsed = now - prev_time
            prev_time = now
            fps = 1.0 / elapsed if elapsed > 0 else 0.0

            # Write the FPS text in the top-left corner (10, 30) in green.
            cv2.putText(
                frame,
                f"FPS: {fps:.1f}",
                (10, 30),                      # x, y position of the text
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0,                           # font scale (size)
                (0, 255, 0),                   # green (BGR)
                2,                             # thickness
                cv2.LINE_AA,                   # anti-aliased = smoother text
            )

            # -------------------------------------------------------------
            # 7. Show the frame, and check for the quit key.
            # -------------------------------------------------------------
            cv2.imshow("Hand Tracking - press 'q' to quit", frame)

            # waitKey(1) waits 1 ms for a key and also lets the window redraw.
            # & 0xFF keeps only the relevant bits so the comparison works across
            # platforms. If the key is 'q', leave the loop.
            if (cv2.waitKey(1) & 0xFF) == ord("q"):
                break

    # -----------------------------------------------------------------------
    # 8. Clean up: release the camera and close the OpenCV window.
    # -----------------------------------------------------------------------
    # This runs after the loop ends (q pressed or an error broke us out).
    cap.release()
    cv2.destroyAllWindows()


# Standard Python entry point: only run main() when this file is executed
# directly (python hand_tracker.py), not when it's imported by something else.
if __name__ == "__main__":
    main()
