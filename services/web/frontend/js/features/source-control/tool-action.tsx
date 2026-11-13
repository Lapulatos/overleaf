import type { ButtonHTMLAttributes } from 'react'
import MaterialIcon from '@/shared/components/material-icon'

export default function ToolAction({ icon, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string }) {
  return <button type="button" className="native-git-tool-action" {...props}><MaterialIcon type={icon} /><span>{children}</span></button>
}
