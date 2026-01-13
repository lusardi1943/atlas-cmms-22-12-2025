package com.grash.service;

import com.grash.advancedsearch.SearchCriteria;
import com.grash.advancedsearch.SpecificationBuilder;
import lombok.extern.slf4j.Slf4j;
import com.grash.dto.SignupSuccessResponse;
import com.grash.dto.SuccessResponse;
import com.grash.dto.UserPatchDTO;
import com.grash.dto.UserSignupRequest;
import com.grash.event.CompanyCreatedEvent;
import com.grash.exception.CustomException;
import com.grash.mapper.UserMapper;
import com.grash.model.*;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
import com.grash.repository.UserRepository;
import com.grash.repository.VerificationTokenRepository;
import com.grash.security.JwtTokenProvider;
import com.grash.utils.Helper;
import com.grash.utils.Utils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.MessageSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import javax.mail.MessagingException;
import javax.persistence.EntityManager;
import javax.servlet.http.HttpServletRequest;
import javax.transaction.Transactional;
import java.util.*;


@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final EntityManager em;
    private final AuthenticationManager authenticationManager;
    private final Utils utils;
    private final MessageSource messageSource;
    private final EmailService2 emailService2;
    private final RoleService roleService;
    private final CompanyService companyService;
    private final CurrencyService currencyService;
    private final UserInvitationService userInvitationService;
    private final VerificationTokenRepository verificationTokenRepository;
    private final SubscriptionPlanService subscriptionPlanService;
    private final SubscriptionService subscriptionService;
    private final UserMapper userMapper;
    private final BrandingService brandingService;
    private final DemoDataService demoDataService;
    private final ApplicationEventPublisher applicationEventPublisher;

    @Value("${api.host}")
    private String PUBLIC_API_URL;
    @Value("${frontend.url}")
    private String frontendUrl;
    @Value("${mail.recipients:#{null}}")
    private String[] recipients;
    @Value("${security.invitation-via-email}")
    private boolean enableInvitationViaEmail;
    @Value("${mail.enable}")
    private boolean enableMails;
    @Value("${cloud-version}")
    private boolean cloudVersion;
    @Value("${allowed-organization-admins}")
    private String[] allowedOrganizationAdmins;


    public String signin(String email, String password, String type) {
        try {
            log.info("Attempting signin for email: {} with type: {}", email, type);
            Authentication authentication =
                    authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, password));
            log.info("Authentication successful for email: {}", email);
            if (authentication.getAuthorities().stream().noneMatch(grantedAuthority -> grantedAuthority.getAuthority().equals("ROLE_" + type.toUpperCase()))) {
                log.warn("Role mismatch for user {}. Expected ROLE_{}, but found {}", email, type.toUpperCase(), authentication.getAuthorities());
                throw new CustomException("Invalid credentials", HttpStatus.FORBIDDEN);
            }
            Optional<OwnUser> optionalUser = userRepository.findByEmailIgnoreCase(email);
            if (!optionalUser.isPresent()) {
                log.error("User not found in repository after successful authentication for email: {}", email);
                throw new CustomException("Invalid credentials", HttpStatus.FORBIDDEN);
            }
            OwnUser user = optionalUser.get();
            log.info("User {} found, last login: {}", email, user.getLastLogin());
            user.setLastLogin(new Date());
            userRepository.save(user);
            return jwtTokenProvider.createToken(email, Collections.singletonList(user.getRole().getRoleType()));
        } catch (AuthenticationException e) {
            log.warn("Authentication failed for email: {}. Error: {}", email, e.getMessage());
            throw new CustomException("Invalid credentials", HttpStatus.FORBIDDEN);
        } catch (Exception e) {
            log.error("Unexpected error during signin for email: {}", email, e);
            throw e;
        }
    }

    private void onCompanyAndUserCreation(OwnUser user) {
        if (cloudVersion && user.isOwnsCompany()) {
            applicationEventPublisher.publishEvent(new CompanyCreatedEvent(user));
        }
    }

    private SignupSuccessResponse<OwnUser> enableAndReturnToken(OwnUser user, boolean sendEmailToSuperAdmins,
                                                                UserSignupRequest userSignupRequest) {
        user.setEnabled(true);
        userRepository.save(user);
        if (sendEmailToSuperAdmins)
            sendRegistrationMailToSuperAdmins(user, userSignupRequest);
        onCompanyAndUserCreation(user);
        return new SignupSuccessResponse<>(true, jwtTokenProvider.createToken(user.getEmail(),
                Collections.singletonList(user.getRole().getRoleType())), user);
    }

    public SignupSuccessResponse<OwnUser> signup(UserSignupRequest userReq) {
        OwnUser user = userMapper.toModel(userReq);
        user.setEmail(user.getEmail().toLowerCase());
        if (userRepository.existsByEmailIgnoreCase(user.getEmail())) {
            throw new CustomException("Email is already in use", HttpStatus.UNPROCESSABLE_ENTITY);

        }
        if (allowedOrganizationAdmins != null && userReq.getRole() == null && allowedOrganizationAdmins.length != 0 && Arrays.stream(allowedOrganizationAdmins).noneMatch(allowedOrganizationAdmin -> allowedOrganizationAdmin.equalsIgnoreCase(userReq.getEmail()))) {
            throw new CustomException("You are not allowed to create an account without being invited",
                    HttpStatus.NOT_ACCEPTABLE);
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setUsername(utils.generateStringId());
        if (user.getRole() == null) {
            //create company with default roles
            Subscription subscription =
                    Subscription.builder().usersCount(cloudVersion ? 10 : 100).monthly(cloudVersion)
                            .startsOn(new Date())
                            .endsOn(cloudVersion ? Helper.incrementDays(new Date(), 15) : null)
                            .subscriptionPlan(subscriptionPlanService.findByCode("BUSINESS").get()).build();
            subscriptionService.create(subscription);
            Company company = new Company(userReq.getCompanyName(), userReq.getEmployeesCount(), subscription);
            company.setDemo(Boolean.TRUE.equals(userReq.getDemo()));
            company.getCompanySettings().getGeneralPreferences().setCurrency(currencyService.findByCode("$").get());
            if (userReq.getLanguage() != null)
                company.getCompanySettings().getGeneralPreferences().setLanguage(userReq.getLanguage());
            companyService.create(company);
            user.setOwnsCompany(true);
            user.setCompany(company);
            user.setRole(company.getCompanySettings().getRoleList().stream().filter(role -> role.getName().equals(
                    "Administrator")).findFirst().get());
        } else {
            Optional<Role> optionalRole = roleService.findById(user.getRole().getId());
            if (!optionalRole.isPresent())
                throw new CustomException("Role not found", HttpStatus.NOT_ACCEPTABLE);
            List<UserInvitation> userInvitations =
                    userInvitationService.findByRoleAndEmail(optionalRole.get().getId(), user.getEmail());
            if (enableInvitationViaEmail && userInvitations.isEmpty()) {
                throw new CustomException("You are not invited to this organization for this role",
                        HttpStatus.NOT_ACCEPTABLE);
            }
            userInvitations.sort(Comparator.comparing(UserInvitation::getCreatedAt).reversed());
            user.setRole(optionalRole.get());
            if (optionalRole.get().getCompanySettings() == null) {
                Optional<OwnUser> optionalInviter = findById(userInvitations.get(0).getCreatedBy());
                if (!optionalInviter.isPresent())
                    throw new CustomException("Inviter not found", HttpStatus.NOT_ACCEPTABLE);
                user.setCompany(optionalInviter.get().getCompany());
            } else user.setCompany(optionalRole.get().getCompanySettings().getCompany());
            return enableAndReturnToken(user, true, userReq);
        }
        if (Helper.isLocalhost(PUBLIC_API_URL)) {
            return enableAndReturnToken(user, false, userReq);
        } else {
            if (userReq.getRole() == null) { //send mail
                if (enableInvitationViaEmail) {
                    throwIfEmailNotificationsNotEnabled();
                    String token = UUID.randomUUID().toString();
                    String link = PUBLIC_API_URL + "/auth/activate-account?token=" + token;
                    Map<String, Object> variables = new HashMap<String, Object>() {{
                        put("verifyTokenLink", link);
                        put("featuresLink", frontendUrl + "/#key-features");
                    }};
                    user = userRepository.save(user);
                    VerificationToken newUserToken = new VerificationToken(token, user, null);
                    verificationTokenRepository.save(newUserToken);
                    emailService2.sendMessageUsingThymeleafTemplate(new String[]{user.getEmail()},
                            messageSource.getMessage("confirmation_email", null, Helper.getLocale(user)), variables,
                            "signup.html", Helper.getLocale(user));
                } else {
                    return enableAndReturnToken(user, true, userReq);
                }
            }
            if (Boolean.TRUE.equals(userReq.getDemo()))
                return enableAndReturnToken(user, false, userReq);
            userRepository.save(user);
            onCompanyAndUserCreation(user);
            sendRegistrationMailToSuperAdmins(user, userReq);
            return new SignupSuccessResponse<>(true, "Successful registration. Check your mailbox to activate your " +
                    "account", null);
        }

    }

    /**
     * Creates a new user member directly under the creator's company.
     * Use this method for administrators adding users manually, bypassing the invitation flow.
     * This resolves the issue where "Index: 0, Size: 0" occurred when creating users without an existing invitation record.
     *
     * @param userReq The signup request details.
     * @param creator The current admin user initiating the creation.
     * @return The created OwnUser entity.
     */
    public OwnUser createMember(UserSignupRequest userReq, OwnUser creator) {
        OwnUser user = userMapper.toModel(userReq);
        user.setEmail(user.getEmail().toLowerCase());
        if (userRepository.existsByEmailIgnoreCase(user.getEmail())) {
            throw new CustomException("Email is already in use", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setUsername(utils.generateStringId());
        
        Optional<Role> optionalRole = roleService.findById(user.getRole().getId());
        if (!optionalRole.isPresent())
            throw new CustomException("Role not found", HttpStatus.NOT_ACCEPTABLE);
            
        Role role = optionalRole.get();
        if (!role.belongsToCompany(creator.getCompany())) {
             throw new CustomException("Role does not belong to your company", HttpStatus.FORBIDDEN);
        }

        user.setRole(role);
        user.setCompany(creator.getCompany());
        
        user.setEnabled(true);
        userRepository.save(user);
        
        // Optional: Send welcome email or notification if needed
        
        return user;
    }

    public void delete(String username) {
        userRepository.deleteByUsername(username);
    }

    public Optional<OwnUser> findByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email);
    }

    public Optional<OwnUser> findByEmailAndCompany(String email, Long companyId) {
        return userRepository.findByEmailIgnoreCaseAndCompany_Id(email, companyId);
    }

    public Optional<OwnUser> findByIdAndCompany(Long id, Long companyId) {
        return userRepository.findByIdAndCompany_Id(id, companyId);
    }

    public OwnUser whoami(HttpServletRequest req) {
        return userRepository.findByEmailIgnoreCase(jwtTokenProvider.getUsername(jwtTokenProvider.resolveToken(req))).get();
    }

    public String refresh(String username) {
        return jwtTokenProvider.createToken(username,
                Arrays.asList(userRepository.findByEmailIgnoreCase(username).get().getRole().getRoleType()));
    }

    public List<OwnUser> getAll() {
        return userRepository.findAll();
    }

    public long count() {
        return userRepository.count();
    }

    public Optional<OwnUser> findById(Long id) {
        return userRepository.findById(id);
    }

    public void enableUser(String email) {
        OwnUser user = userRepository.findByEmailIgnoreCase(email).get();
        if (user.getRole().isPaid()) {
            int companyUsersCount =
                    (int) findByCompany(user.getCompany().getId()).stream().filter(user1 -> user1.isEnabled() && user1.isEnabledInSubscriptionAndPaid()).count();
            if (companyUsersCount + 1 > user.getCompany().getSubscription().getUsersCount())
                throw new CustomException("You can't add more users to this company", HttpStatus.NOT_ACCEPTABLE);
        }
        // Habilita al usuario y limpia la fecha de desactivación temporal
        user.setEnabled(true);
        user.setDeactivatedUntil(null);
        // Si el usuario fue "eliminado" (soft-delete), el email contiene un sufijo " _ ID".
        // Lo restauramos a su valor original para permitir el acceso.
        if (user.getEmail().contains(" _ ")) {
            user.setEmail(user.getEmail().split(" _ ")[0]);
        }
        userRepository.save(user);
    }

    public SuccessResponse resetPasswordRequest(String email) {
        throwIfEmailNotificationsNotEnabled();
        email = email.toLowerCase();
        OwnUser user = findByEmail(email).get();
        Helper helper = new Helper();
        String password = helper.generateString().replace("-", "").substring(0, 8).toUpperCase();

        String token = UUID.randomUUID().toString();
        Map<String, Object> variables = new HashMap<String, Object>() {{
            put("featuresLink", frontendUrl + "/#key-features");
            put("resetConfirmLink", PUBLIC_API_URL + "/auth/reset-pwd-confirm?token=" + token);
            put("password", password);
        }};
        VerificationToken newUserToken = new VerificationToken(token, user, password);
        verificationTokenRepository.save(newUserToken);
        emailService2.sendMessageUsingThymeleafTemplate(new String[]{email}, messageSource.getMessage("password_reset"
                        , new String[]{brandingService.getBrandConfig().getName()}, Helper.getLocale(user)), variables,
                "reset-password.html", Helper.getLocale(user));
        return new SuccessResponse(true, "Password changed successfully");
    }

    public Collection<OwnUser> findByCompany(Long id) {
        return userRepository.findByCompany_Id(id);
    }

    public Collection<OwnUser> findWorkersByCompany(Long id) {
        return userRepository.findWorkersByCompany(id, Arrays.asList(RoleCode.REQUESTER, RoleCode.VIEW_ONLY));
    }

    public Collection<OwnUser> findByLocation(Long id) {
        return userRepository.findByLocation_Id(id);
    }

    private void throwIfEmailNotificationsNotEnabled() {
        if (!enableMails)
            throw new CustomException("Please enable mails and configure SMTP in the environment variables",
                    HttpStatus.NOT_ACCEPTABLE);
    }

    public void invite(String email, Role role, OwnUser inviter) {
        throwIfEmailNotificationsNotEnabled();
        if (!userRepository.existsByEmailIgnoreCase(email) && Helper.isValidEmailAddress(email)) {
            userInvitationService.create(new UserInvitation(email, role));
            Map<String, Object> variables = new HashMap<String, Object>() {{
                put("joinLink", frontendUrl + "/account/register?" + "email=" + email + "&role=" + role.getId());
                put("featuresLink", frontendUrl + "/#key-features");
                put("inviter", inviter.getFirstName() + " " + inviter.getLastName());
                put("company", inviter.getCompany().getName());
            }};
            emailService2.sendMessageUsingThymeleafTemplate(new String[]{email}, messageSource.getMessage(
                            "invitation_to_use", new String[]{brandingService.getBrandConfig().getName()},
                            Helper.getLocale(inviter)), variables, "invite.html",
                    Helper.getLocale(inviter));
        } else throw new CustomException("Email already in use", HttpStatus.NOT_ACCEPTABLE);
    }

    @org.springframework.transaction.annotation.Transactional
    public OwnUser update(Long id, UserPatchDTO userReq, OwnUser requester) {
        if (userRepository.existsById(id)) {
            OwnUser savedUser = userRepository.findById(id).get();
            if (userReq.getNewPassword() != null) {
                if (userReq.getNewPassword().length() < 8)
                    throw new CustomException("Password must be at least 8 characters", HttpStatus.NOT_ACCEPTABLE);

                boolean canEditOthers = requester.getRole().getEditOtherPermissions().contains(PermissionEntity.PEOPLE_AND_TEAMS);

                if (enableInvitationViaEmail && !canEditOthers)
                    throw new CustomException("Please tell the user to reset his password", HttpStatus.NOT_FOUND);

                savedUser.setPassword(passwordEncoder.encode(userReq.getNewPassword()));
            }

            // Email update logic
            if (userReq.getEmail() != null && !userReq.getEmail().equalsIgnoreCase(savedUser.getEmail())) {
                String newEmail = userReq.getEmail().toLowerCase();
                if (userRepository.existsByEmailIgnoreCase(newEmail)) {
                    throw new CustomException("Email is already in use", HttpStatus.UNPROCESSABLE_ENTITY);
                }
                savedUser.setEmail(newEmail);
            }
            
            // Deactivation logic
            if (userReq.getDeactivatedUntil() != null) {
                savedUser.setDeactivatedUntil(userReq.getDeactivatedUntil());
                savedUser.setEnabled(false);
            } else if (Boolean.FALSE.equals(userReq.getEnabled())) {
                savedUser.setEnabled(false);
                savedUser.setDeactivatedUntil(null);
            }

            OwnUser updatedUser = userRepository.saveAndFlush(userMapper.updateUser(savedUser, userReq));
            em.refresh(updatedUser);
            return updatedUser;
        } else throw new CustomException("Not found", HttpStatus.NOT_FOUND);
    }

    public OwnUser save(OwnUser user) {
        return userRepository.save(user);
    }

    public Collection<OwnUser> saveAll(Collection<OwnUser> users) {
        return userRepository.saveAll(users);
    }

    public boolean existsByEmail(String email) {
        return userRepository.existsByEmailIgnoreCase(email);
    }

    public boolean isUserInCompany(OwnUser user, long companyId, boolean optional) {
        if (optional) {
            Optional<OwnUser> optionalUser = user == null ? Optional.empty() : findById(user.getId());
            return user == null || (optionalUser.isPresent() && optionalUser.get().getCompany().getId().equals(companyId));
        } else {
            Optional<OwnUser> optionalUser = findById(user.getId());
            return optionalUser.isPresent() && optionalUser.get().getCompany().getId().equals(companyId);
        }
    }


    public Page<OwnUser> findBySearchCriteria(SearchCriteria searchCriteria) {
        SpecificationBuilder<OwnUser> builder = new SpecificationBuilder<>();
        searchCriteria.getFilterFields().forEach(builder::with);
        Pageable page = PageRequest.of(searchCriteria.getPageNum(), searchCriteria.getPageSize(),
                searchCriteria.getDirection(), searchCriteria.getSortField());
        return userRepository.findAll(builder.build(), page);
    }

    @Async
    void sendRegistrationMailToSuperAdmins(OwnUser user, UserSignupRequest userSignupRequest) {
        if (user.getEmail().equals("superadmin@test.com")) return;
        if (user.getCompany() != null && user.getCompany().isDemo()) return;
        if (recipients == null || recipients.length == 0) {
            return;
//            throw new CustomException("MAIL_RECIPIENTS env variable not set", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        try {
            String subject = buildRegistrationEmailSubject(userSignupRequest, brandingService);
            String body = buildRegistrationEmailBody(user, userSignupRequest);
            emailService2.sendHtmlMessage(recipients, subject, body);
        } catch (MessagingException e) {
            e.printStackTrace();
        }
    }

    private String buildRegistrationEmailSubject(UserSignupRequest request, BrandingService brandingService) {
        String brandName = brandingService.getBrandConfig().getShortName();

        if (request.getSubscriptionPlanId() == null) {
            return String.format("New %s registration", brandName);
        }

        return String.format("%s plan %s used", brandName, request.getSubscriptionPlanId());
    }

    private String buildRegistrationEmailBody(OwnUser user, UserSignupRequest request) {
        StringBuilder body = new StringBuilder();

        // User basic info
        body.append(String.format("%s %s just created an account%n",
                user.getFirstName(),
                user.getLastName()));

        // Company info
        body.append(String.format("Company: %s (%s employees)%n",
                user.getCompany().getName(),
                request.getEmployeesCount()));

        // Contact info
        body.append(String.format("Email: %s%n", user.getEmail()));
        body.append(String.format("Phone: %s%n", user.getPhone()));

        // Registration type
        if (!user.isOwnsCompany()) {
            body.append("Registration type: After invitation\n");
        }

        // UTM parameters
        appendUtmParameters(body, request);

        return body.toString();
    }

    private void appendUtmParameters(StringBuilder body, UserSignupRequest request) {
        if (!cloudVersion || request.getUtmParams() == null || !request.getUtmParams().hasAnyParam()) return;
        body.append("\n--- Marketing Attribution ---\n");
        if (request.getUtmParams().getReferrer() != null) {
            body.append(String.format("Referrer: %s%n", request.getUtmParams().getReferrer()));
        }
        if (request.getUtmParams().getUtm_source() != null) {
            body.append(String.format("UTM Source: %s%n", request.getUtmParams().getUtm_source()));
        }
        if (request.getUtmParams().getUtm_medium() != null) {
            body.append(String.format("UTM Medium: %s%n", request.getUtmParams().getUtm_medium()));
        }
        if (request.getUtmParams().getUtm_campaign() != null) {
            body.append(String.format("UTM Campaign: %s%n", request.getUtmParams().getUtm_campaign()));
        }
        if (request.getUtmParams().getUtm_term() != null) {
            body.append(String.format("UTM Term: %s%n", request.getUtmParams().getUtm_term()));
        }
        if (request.getUtmParams().getUtm_content() != null) {
            body.append(String.format("UTM Content: %s%n", request.getUtmParams().getUtm_content()));
        }
        if (request.getUtmParams().getGclid() != null) {
            body.append(String.format("Google Click ID: %s%n", request.getUtmParams().getGclid()));
        }
        if (request.getUtmParams().getFbclid() != null) {
            body.append(String.format("Facebook Click ID: %s%n", request.getUtmParams().getFbclid()));
        }
    }
}
