import React from "react";
import ProjectDetails from "./organisms/project-details/project-details";
import { useParams,} from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";

// Data arrays (same as before)
const modalHeaders = [
  "NFT Market",
  "결제 연동",
  "코인 개발",
  "API·플랫폼",
  "데이터 분석",
  "툴·자동화"
];
const modalDescriptions = [
  "This is a pre-sale sample page for the DS.WAR LAND ITEM event. Buy items using USDT or lucky box tokens.",
  "여기에 결제 연동 관련 문서 내용을 적으세요.",
  "여기에 코인 개발 관련 문서 내용을 적으세요.",
  "여기에 API·플랫폼 관련 문서 내용을 적으세요.",
  "여기에 데이터 분석 관련 문서 내용을 적으세요.",
  "여기에 툴·자동화 관련 문서 내용을 적으세요."
];
const thumbnails = [
  [
    "/images/projects/dswar/one-ex.png",
    "/images/projects/dswar/two-ex.png",
    "/images/projects/dswar/three-ex.png",
    "/images/projects/dswar/shini-ex.png",
    "/images/projects/dswar/dswar-ex.png"
  ],
  [],
  [],
  [],
  [],
  []
];

// Map docType from URL to an index for your content
const docTypeToIndex: { [key: string]: number } = {
  "nft-market": 0,
  "payment-integration": 1,
  "coin-development": 2,
  "api-platform": 3,
  "data-analysis": 4,
  "automation-tools": 5,
};

// Content rendering logic (same as before)
const modalContents = [
  () => (
    <>
      <ProjectDetails
        title={modalHeaders[0]}
        url="(https://dswmarket.devwlt.org)"
        description={modalDescriptions[0]}
        images={thumbnails[0]}
        initialImage="/images/projects/dswar/dswar-ex.png"
      />
      <ProjectDetails
        title="SHINI Homepage"
        url="https://xn--zv4bu7f.com/"
        description="신이 is a major South Korean cleaning franchise with over 3,000 locations nationwide.
The company offers professional cleaning services, emphasizing quick response and high-quality work performed by trained staff.
Customers can conveniently book their services through KakaoTalk or the website."
        images={[
          "/images/projects/shini/shini-ex4.mp4",
          "/images/projects/shini/shini-ex2.jpg",
          "/images/projects/shini/shini-ex3.jpg"
        ]}
        initialImage="/images/projects/shini/shini-ex4.mp4"
        videoThumb="/images/projects/shini/shini-ex1.jpg"
      />
    </>
  ),
  () => (
    <>
      <ProjectDetails
        title="c9-Pro"
        url="https://c9-pro.com"
        description={modalDescriptions[1]}
        images={[
          "/images/projects/c9pro/c9pro-ex1.mp4",
          "/images/projects/c9pro/c9pro-ex2.png",
          "/images/projects/c9pro/c9pro-ex3.png",
          "/images/projects/c9pro/c9pro-ex4.png"
        ]}
        initialImage="/images/projects/c9pro/c9pro-ex1.mp4"
        videoThumb="/images/projects/c9pro/c9pro-ex5.png"
      />
    </>
  ),
  () => (
    <div className="text-white p-8">No details for this section yet.</div>
  ),
  () => (
    <div className="text-white p-8">No details for this section yet.</div>
  ),
  () => (
    <div className="text-white p-8">No details for this section yet.</div>
  ),
  () => (
    <div className="text-white p-8">No details for this section yet.</div>
  ),
];

// The DocumentationPage component
export const DocumentationPage: React.FC = () => {
  const { docType } = useParams<{ docType: string }>();
  const index = docTypeToIndex[docType ?? ""];

  // If docType is invalid, you can redirect to a 404 page or show an error
  if (typeof index !== "number" || index < 0 || index >= modalContents.length) {
    return <div className="text-white p-12 text-2xl">페이지를 찾을 수 없습니다.</div>;
    // Or: return <Navigate to="/404" />;
  }

  return (
    <main>
      <section className="max-w-screen-lg xl:max-w-screen-xl mx-auto bg-black bg-opacity-50">
        <div className="sticky top-0 z-10 bg-black bg-opacity-50 w-full flex flex-col pt-7">
          <Link
            to="/"
            className="inline-flex items-center gap-2 group w-max hover:underline focus:outline-none ml-7">
            <span className="group-hover:underline decoration-blue-400 underline-offset-4">
              <ArrowLeftIcon className="h-7 w-7 text-white" />
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-white pb-2 group-hover:underline decoration-blue-400 underline-offset-4">
              뒤로가기
            </span>
          </Link>
        </div>
        {modalContents[index]()}
      </section>
    </main>
  );
};

export default DocumentationPage;
