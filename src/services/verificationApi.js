const delay = (ms = 700) => new Promise((resolve) => setTimeout(resolve, ms));

export async function uploadID({ idFront, idBack }) {
  await delay();
  return { idFront, idBack, uploaded: true };
}

export async function captureFace(faceImage) {
  await delay(500);
  return { faceImage, captured: true };
}

export async function runLiveness() {
  await delay(1200);
  return { status: "verified" };
}

export async function submitVerification(payload) {
  await delay(900);
  return {
    ...payload,
    verificationStatus: "VERIFIED",
  };
}
