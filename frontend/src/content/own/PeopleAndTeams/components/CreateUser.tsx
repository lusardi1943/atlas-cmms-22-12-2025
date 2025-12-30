import { Grid } from '@mui/material';
import RegisterJWT from '../../../pages/Auth/Register/RegisterJWT';
import { getUsers, createUserMember } from '../../../../slices/user';
import { useDispatch } from '../../../../store';

export default function CreateUser({
  roleId,
  onClose,
  onRefreshUsers
}: {
  roleId: number;
  onClose: () => void;
  onRefreshUsers: () => void;
}) {
  const dispatch = useDispatch();

  // Handler for direct user creation by admins
  // Uses createUserMember action to bypassing invitation flow
  const handleCreateUser = async (values: any) => {
    await dispatch(createUserMember(values));
  };

  return (
    <Grid container sx={{ pb: 3 }}>
      <RegisterJWT
        role={roleId}
        invitationMode
        onSubmit={handleCreateUser}
        onInvitationSuccess={() => {
          onClose();
          onRefreshUsers();
        }}
      />
    </Grid>
  );
}
