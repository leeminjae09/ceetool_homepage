import { useEffect, useState } from "react";
import { homepageApi, type HomepageContent } from "app/homepage-api";

export function useHomepageContent() {
  const [content, setContent] = useState<HomepageContent | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    void homepageApi
      .load()
      .then((saved) => {
        if (active) setContent(saved.content);
      })
      .catch((error: unknown) => {
        console.error(
          "Homepage settings request failed",
          error instanceof Error ? error.name : "unknown",
        );
        if (active)
          setError(
            "홈페이지 구성을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
          );
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return { content, error, retry: () => setRevision((value) => value + 1) };
}
