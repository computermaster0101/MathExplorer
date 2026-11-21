// Values that several modules reassign. ES module imports are read-only, so these live on one shared object.
export const shared = { recCapH: 0 };   // recCapH: video height while recording at 720p/1080p (0 = not capped)
