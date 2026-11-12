import { ProjectMember } from '@/shared/context/types/project-metadata'
import {
  deleteJSON,
  getJSON,
  postJSON,
  putJSON,
} from '../../../infrastructure/fetch-json'
import { executeV2Captcha } from './captcha'
import getMeta from '@/utils/meta'
import { PermissionsLevel } from '@/features/ide-react/types/permissions'

// Membership belongs to the logical paper project, not branch storage.
// Only remap the workspace currently named by the canonical editor URL.
export function sharingProjectId(
  projectId: string,
  pathname = window.location.pathname
) {
  const match = pathname.match(
    /^\/project\/([a-f0-9]{24})\/workspace\/([a-f0-9]{24})\/?$/i
  )
  return match && match[2] === projectId ? match[1] : projectId
}

export function sendInvite(
  projectId: string,
  email: string,
  privileges: PermissionsLevel
) {
  return executeV2Captcha(
    getMeta('ol-ExposedSettings').recaptchaDisabled?.invite
  ).then(grecaptchaResponse => {
    return postJSON(`/project/${sharingProjectId(projectId)}/invite`, {
      body: {
        email, // TODO: normalisedEmail?
        privileges,
        'g-recaptcha-response': grecaptchaResponse,
      },
    })
  })
}

export function resendInvite(projectId: string, invite: ProjectMember) {
  return postJSON(`/project/${sharingProjectId(projectId)}/invite/${invite._id}/resend`)
}

export function revokeInvite(projectId: string, invite: ProjectMember) {
  return deleteJSON(`/project/${sharingProjectId(projectId)}/invite/${invite._id}`)
}

export function updateMember(
  projectId: string,
  member: ProjectMember,
  data: { privilegeLevel: PermissionsLevel }
) {
  return putJSON(`/project/${sharingProjectId(projectId)}/users/${member._id}`, {
    body: data,
  })
}

export function removeMemberFromProject(
  projectId: string,
  member: ProjectMember
) {
  return deleteJSON(`/project/${sharingProjectId(projectId)}/users/${member._id}`)
}

export function transferProjectOwnership(
  projectId: string,
  member: ProjectMember
) {
  return postJSON(`/project/${sharingProjectId(projectId)}/transfer-ownership`, {
    body: {
      user_id: member._id,
    },
  })
}

export function setPublicAccessLevel(
  projectId: string,
  publicAccessLevel: string
) {
  return postJSON(`/project/${sharingProjectId(projectId)}/settings/admin`, {
    body: { publicAccessLevel },
  })
}

export function listProjectMembers(projectId: string) {
  return getJSON(`/project/${sharingProjectId(projectId)}/members`)
}

export function listProjectInvites(projectId: string) {
  return getJSON(`/project/${sharingProjectId(projectId)}/invites`)
}
