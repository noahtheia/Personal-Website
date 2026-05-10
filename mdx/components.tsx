// Component map passed to <MDXRemote components={...}> in app/posts/[slug]/page.tsx.
// Anything listed here can be used as a JSX tag inside a post's .mdx body.
//
// The chart components are "use client" islands (they need hover/state); listing
// them here from this server module is the supported way to embed client
// components inside next-mdx-remote/rsc-rendered MDX. Each chart already wraps
// its own root in `not-prose` so it isn't restyled by the post's `.prose`
// container; `NotProse` is exposed for hand-written tables/figures in MDX.

import { NotProse } from "@/components/charts/NotProse";
import { CroplandByRegion } from "@/components/charts/CroplandByRegion";
import { CropYields } from "@/components/charts/CropYields";
import { CornFarmEconomics } from "@/components/charts/CornFarmEconomics";
import { SeedChemConcentration } from "@/components/charts/SeedChemConcentration";
import { FarmInputCosts } from "@/components/charts/FarmInputCosts";
import { RealCommodityPrices } from "@/components/charts/RealCommodityPrices";
import { AgInflationOutlook } from "@/components/charts/AgInflationOutlook";

export const mdxComponents = {
  NotProse,
  CroplandByRegion,
  CropYields,
  CornFarmEconomics,
  SeedChemConcentration,
  FarmInputCosts,
  RealCommodityPrices,
  AgInflationOutlook,
};
