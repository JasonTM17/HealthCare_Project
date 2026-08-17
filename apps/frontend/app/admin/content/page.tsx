"use client";

import CmsEditor from "../../../components/cms/CmsEditor";
import { authenticatedCmsClient } from "../../../lib/cms-client";

export default function AdminContentPage(): React.ReactElement {
  return <CmsEditor client={authenticatedCmsClient} />;
}
