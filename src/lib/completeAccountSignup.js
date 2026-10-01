import { supabase } from "./supabaseClient";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export async function completeAccountSignup(userId) {
  if (!userId) return;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user || user.id !== userId) return;

  const metadata = user.user_metadata || {};
  const signupType = metadata.signup_type;

  if (signupType !== "client" && signupType !== "photographer") {
    return;
  }

  const firstName = String(metadata.first_name || "").trim();
  const lastName = String(metadata.last_name || "").trim();

  if (!firstName || !lastName || !user.email) {
    throw new Error("Your LensFlow account details are incomplete.");
  }

  let selectedPhotographerId = null;

  if (signupType === "client") {
    selectedPhotographerId = String(
      metadata.photographer_id || ""
    ).trim();

    if (!selectedPhotographerId) {
      throw new Error(
        "No photographer was selected for this client account."
      );
    }

    // Public client signup is only available for photographers who have
    // intentionally published their LensFlow website/profile.
    const {
      data: photographer,
      error: photographerError,
    } = await supabase
      .from("photographer_profiles")
      .select("photographer_id")
      .eq("photographer_id", selectedPhotographerId)
      .eq("published", true)
      .maybeSingle();

    if (photographerError) throw photographerError;

    if (!photographer) {
      throw new Error(
        "The selected photographer is no longer available for online signup."
      );
    }
  }

  const businessName = String(
    metadata.business_name || ""
  ).trim();

  if (signupType === "photographer" && !businessName) {
    throw new Error(
      "Your photography business details are incomplete."
    );
  }

  const {
    data: existingProfile,
    error: profileLookupError,
  } = await supabase
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileLookupError) throw profileLookupError;

  if (!existingProfile) {
    const { error: profileInsertError } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        role: signupType,
        first_name: firstName,
        last_name: lastName,
        email: user.email,
      });

    if (
      profileInsertError &&
      profileInsertError.code !== "23505"
    ) {
      throw profileInsertError;
    }
  } else if (existingProfile.role !== signupType) {
    // Existing accounts keep their established role.
    // Never change roles based only on editable auth metadata.
    return;
  }

  // =========================================================
  // CLIENT ACCOUNT SETUP
  // =========================================================

  if (signupType === "client") {
    const {
      data: existingClient,
      error: clientLookupError,
    } = await supabase
      .from("clients")
      .select("client_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (clientLookupError) throw clientLookupError;

    if (!existingClient) {
      const { error: clientInsertError } = await supabase
        .from("clients")
        .insert({
          user_id: userId,
          photographer_id: selectedPhotographerId,
        });

      if (
        clientInsertError &&
        clientInsertError.code !== "23505"
      ) {
        throw clientInsertError;
      }
    }

    return;
  }

  // =========================================================
  // PHOTOGRAPHER ACCOUNT SETUP
  // =========================================================

  const {
    data: existingPhotographer,
    error: photographerLookupError,
  } = await supabase
    .from("photographer_profiles")
    .select("photographer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (photographerLookupError) {
    throw photographerLookupError;
  }

  if (!existingPhotographer) {
    const baseSlug =
      slugify(businessName) || "photographer";

    const uniqueSlug =
      `${baseSlug}-${userId.slice(0, 8)}`;

    const { error: photographerInsertError } =
      await supabase
        .from("photographer_profiles")
        .insert({
          user_id: userId,
          business_name: businessName,
          slug: uniqueSlug,
          email: user.email,
          published: false,
        });

    if (
      photographerInsertError &&
      photographerInsertError.code !== "23505"
    ) {
      throw photographerInsertError;
    }
  }
}