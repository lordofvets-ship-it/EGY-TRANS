import crypto from "crypto";
import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "data", "audio_cache");

// Ensure cache directory exists
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (_) {}

/**
 * Computes a deterministic SHA-256 fingerprint for the audio buffer.
 */
export function computeAudioHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Normalizes a hash or call ID (strips "call-" prefix if present).
 */
export function normalizeAudioHash(hashOrId: string): string {
  return String(hashOrId || "")
    .trim()
    .replace(/^call-/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Retrieves cached evaluation result by audio SHA-256 hash.
 */
export async function getCachedAnalysisByHash(audioHash: string): Promise<any | null> {
  const cleanHash = normalizeAudioHash(audioHash);
  if (!cleanHash) return null;
  const filePath = path.join(CACHE_DIR, `${cleanHash}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content);
      return {
        ...parsed,
        cacheHit: true,
        audioHash: cleanHash,
      };
    }
  } catch (err) {
    console.warn(`Failed to read audio cache for hash ${cleanHash}:`, err);
  }
  return null;
}

/**
 * Saves the finalized, validated evaluation result keyed by the audio SHA-256 hash.
 * Uses atomic write (tmp file + rename) to prevent corruption and preserves existing user-edited agentName.
 */
export async function saveAnalysisByHash(audioHash: string, data: any): Promise<void> {
  const cleanHash = normalizeAudioHash(audioHash);
  if (!cleanHash) return;
  const filePath = path.join(CACHE_DIR, `${cleanHash}.json`);
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    let existingAgentName: string | undefined;
    let existingSavedAt: string | undefined;
    if (fs.existsSync(filePath)) {
      try {
        const prev = JSON.parse(await fs.promises.readFile(filePath, "utf-8"));
        if (prev?.userEditedAgentName && prev?.agentName) {
          existingAgentName = prev.agentName;
        }
        if (prev?.savedAt) {
          existingSavedAt = prev.savedAt;
        }
      } catch {}
    }

    const payload = {
      ...data,
      agentName: existingAgentName || data.agentName,
      userEditedAgentName: Boolean(existingAgentName || data.userEditedAgentName),
      audioHash: cleanHash,
      savedAt: data.savedAt || existingSavedAt || new Date().toISOString(),
    };
    const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(payload, null, 2), "utf-8");
    await fs.promises.rename(tmpPath, filePath);
    console.log(`Successfully saved QA analysis by audio hash: ${cleanHash.slice(0, 12)}...`);
  } catch (err) {
    console.warn(`Failed to write audio cache for hash ${cleanHash}:`, err);
  }
}

/**
 * Returns all actually analyzed calls persisted in data/audio_cache, sorted newest first.
 */
export async function getAllCachedAnalyses(): Promise<any[]> {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      return [];
    }
    const files = await fs.promises.readdir(CACHE_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const results: any[] = [];

    for (const file of jsonFiles) {
      const filePath = path.join(CACHE_DIR, file);
      try {
        const content = await fs.promises.readFile(filePath, "utf-8");
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.transcript) && parsed.transcript.length > 0) {
          const hashFromFilename = file.replace(/\.json$/, "");
          const stat = await fs.promises.stat(filePath);
          results.push({
            ...parsed,
            audioHash: parsed.audioHash || hashFromFilename,
            savedAt: parsed.savedAt || stat.mtime.toISOString(),
          });
        }
      } catch (err) {
        console.warn(`Skipping unreadable cache file ${file}:`, err);
      }
    }

    // Sort newest first
    results.sort((a, b) => {
      const tA = new Date(a.savedAt || 0).getTime();
      const tB = new Date(b.savedAt || 0).getTime();
      return tB - tA;
    });

    return results;
  } catch (err) {
    console.warn("Failed to list cached analyses:", err);
    return [];
  }
}

/**
 * Updates metadata (e.g., colleague name) for a cached call without removing or altering its analysis.
 */
export async function updateCachedAnalysisMetadata(
  hashOrId: string,
  updates: { agentName?: string }
): Promise<boolean> {
  const cleanHash = normalizeAudioHash(hashOrId);
  if (!cleanHash) return false;
  const filePath = path.join(CACHE_DIR, `${cleanHash}.json`);
  try {
    if (!fs.existsSync(filePath)) return false;
    const content = await fs.promises.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);
    if (updates.agentName && updates.agentName.trim()) {
      parsed.agentName = updates.agentName.trim();
      parsed.userEditedAgentName = true;
    }
    const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(parsed, null, 2), "utf-8");
    await fs.promises.rename(tmpPath, filePath);
    return true;
  } catch (err) {
    console.warn(`Failed to update metadata for ${cleanHash}:`, err);
    return false;
  }
}

/**
 * Deletes cached evaluation result by audio SHA-256 hash (ONLY when explicitly requested by user).
 */
export async function deleteAudioCacheByHash(hashOrId: string): Promise<boolean> {
  const cleanHash = normalizeAudioHash(hashOrId);
  if (!cleanHash) return false;
  const filePath = path.join(CACHE_DIR, `${cleanHash}.json`);
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`User deleted analyzed call cache for hash: ${cleanHash.slice(0, 12)}...`);
      return true;
    }
  } catch (err) {
    console.warn(`Failed to delete audio cache for hash ${cleanHash}:`, err);
  }
  return false;
}

/**
 * Clears all cached evaluation results (ONLY when explicitly requested by user via Clear All).
 */
export async function deleteAllAudioCache(): Promise<number> {
  let deletedCount = 0;
  try {
    if (!fs.existsSync(CACHE_DIR)) return 0;
    const files = await fs.promises.readdir(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith(".json")) {
        await fs.promises.unlink(path.join(CACHE_DIR, file));
        deletedCount++;
      }
    }
  } catch (err) {
    console.warn("Failed to clear all audio cache:", err);
  }
  return deletedCount;
}
