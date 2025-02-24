import * as Tooltip from '@radix-ui/react-tooltip'
import { FC, useState, useRef, useEffect } from 'react'
import { debounce } from 'lodash'
import generator from 'generate-password'
import { Input, Button, Modal } from 'ui'
import { PermissionAction } from '@supabase/shared-types/out/constants'

import { useCheckPermissions, useStore } from 'hooks'
import { useParams } from 'common/hooks'
import { patch } from 'lib/common/fetch'
import { passwordStrength } from 'lib/helpers'
import { API_URL, DEFAULT_MINIMUM_PASSWORD_STRENGTH } from 'lib/constants'

import Panel from 'components/ui/Panel'
import PasswordStrengthBar from 'components/ui/PasswordStrengthBar'
import { getProjectDetail } from 'data/projects/project-detail-query'

const ResetDbPassword: FC<any> = ({ disabled = false }) => {
  const { ui, app, meta } = useStore()
  const { ref } = useParams()

  const canResetDbPassword = useCheckPermissions(PermissionAction.UPDATE, 'projects')

  const [showResetDbPass, setShowResetDbPass] = useState<boolean>(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false)

  const [password, setPassword] = useState<string>('')
  const [passwordStrengthMessage, setPasswordStrengthMessage] = useState<string>('')
  const [passwordStrengthWarning, setPasswordStrengthWarning] = useState<string>('')
  const [passwordStrengthScore, setPasswordStrengthScore] = useState<number>(0)

  useEffect(() => {
    if (showResetDbPass) {
      setIsUpdatingPassword(false)
      setPassword('')
      setPasswordStrengthMessage('')
      setPasswordStrengthWarning('')
      setPasswordStrengthScore(0)
    }
  }, [showResetDbPass])

  async function checkPasswordStrength(value: any) {
    const { message, warning, strength } = await passwordStrength(value)
    setPasswordStrengthScore(strength)
    setPasswordStrengthWarning(warning)
    setPasswordStrengthMessage(message)
  }

  const delayedCheckPasswordStrength = useRef(
    debounce((value) => checkPasswordStrength(value), 300)
  ).current

  const onDbPassChange = (e: any) => {
    const value = e.target.value
    setPassword(value)
    if (value == '') {
      setPasswordStrengthScore(-1)
      setPasswordStrengthMessage('')
    } else delayedCheckPasswordStrength(value)
  }

  const confirmResetDbPass = async () => {
    if (!ref) return

    if (passwordStrengthScore >= DEFAULT_MINIMUM_PASSWORD_STRENGTH) {
      setIsUpdatingPassword(true)
      const res = await patch(`${API_URL}/projects/${ref}/db-password`, { password })
      if (!res.error) {
        const project = await getProjectDetail({ ref })
        if (project) {
          meta.setProjectDetails(project)
        }

        ui.setNotification({ category: 'success', message: res.message })
        setShowResetDbPass(false)
      } else {
        ui.setNotification({
          category: 'error',
          message: `Failed to reset password: ${res.error.message}`,
        })
      }
      setIsUpdatingPassword(false)
    }
  }

  function generateStrongPassword() {
    const password = generator.generate({
      length: 16,
      numbers: true,
      uppercase: true,
    })
    setPassword(password)
    delayedCheckPasswordStrength(password)
  }

  return (
    <>
      <Panel className="!m-0">
        <Panel.Content>
          <div className="grid grid-cols-1 items-center lg:grid-cols-3">
            <div className="col-span-2 space-y-1">
              <p className="block">Database password</p>
              <p className="text-sm opacity-50">
                You can use this password to connect directly to your Postgres database.
              </p>
            </div>
            <div className="flex items-end justify-end">
              <Tooltip.Root delayDuration={0}>
                <Tooltip.Trigger>
                  <Button
                    type="default"
                    disabled={!canResetDbPassword || disabled}
                    onClick={() => setShowResetDbPass(true)}
                  >
                    Reset Database Password
                  </Button>
                </Tooltip.Trigger>
                {!canResetDbPassword && (
                  <Tooltip.Portal>
                    <Tooltip.Content side="bottom">
                      <Tooltip.Arrow className="radix-tooltip-arrow" />
                      <div
                        className={[
                          'rounded bg-scale-100 py-1 px-2 leading-none shadow', // background
                          'border border-scale-200 ', //border
                        ].join(' ')}
                      >
                        <span className="text-xs text-scale-1200">
                          You need additional permissions to reset the database password
                        </span>
                      </div>
                    </Tooltip.Content>
                  </Tooltip.Portal>
                )}
              </Tooltip.Root>
            </div>
          </div>
        </Panel.Content>
      </Panel>
      <Modal
        hideFooter
        header={<h5 className="text-sm text-scale-1200">Reset database password</h5>}
        confirmText="Reset password"
        alignFooter="right"
        size="medium"
        visible={showResetDbPass}
        loading={isUpdatingPassword}
        onCancel={() => setShowResetDbPass(false)}
      >
        <Modal.Content>
          <div className="w-full space-y-8 py-8">
            <Input
              type="password"
              value={password}
              copy={password.length > 0}
              onChange={onDbPassChange}
              error={passwordStrengthWarning}
              // @ts-ignore
              descriptionText={
                <PasswordStrengthBar
                  passwordStrengthScore={passwordStrengthScore}
                  passwordStrengthMessage={passwordStrengthMessage}
                  password={password}
                  generateStrongPassword={generateStrongPassword}
                />
              }
            />
          </div>
        </Modal.Content>
        <Modal.Separator />
        <Modal.Content>
          <div className="flex space-x-2 pb-2">
            <Button type="default" onClick={() => setShowResetDbPass(false)}>
              Cancel
            </Button>
            <Button
              type="primary"
              loading={isUpdatingPassword}
              disabled={isUpdatingPassword}
              onClick={() => confirmResetDbPass()}
            >
              Reset password
            </Button>
          </div>
        </Modal.Content>
      </Modal>
    </>
  )
}

export default ResetDbPassword
