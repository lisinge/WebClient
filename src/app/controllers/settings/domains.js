angular.module("proton.controllers.Settings")

.controller('DomainsController', function(
    $q,
    $rootScope,
    $scope,
    $translate,
    Address,
    addressModal,
    authentication,
    confirmModal,
    CONSTANTS,
    dkimModal,
    dmarcModal,
    Domain,
    domainModal,
    domains,
    eventManager,
    generateModal,
    Member,
    members,
    mxModal,
    networkActivityTracker,
    notify,
    organization,
    Organization,
    spfModal,
    verificationModal
) {
    // Variables
    $scope.organization = organization.data.Organization;
    $scope.domains = domains.data.Domains;
    $scope.members = members.data.Members;
    $scope.addressMemberID = $scope.members[0];
    $scope.isAdmin = authentication.user.Role === CONSTANTS.PAID_ADMIN;

    // Listeners
    $scope.$on('domain', function(event, domain) {
        $scope.closeModals();
        $scope.addDomain(domain);
    });

    $scope.$on('spf', function(event, domain) {
        $scope.closeModals();
        $scope.spf(domain);
    });

    $scope.$on('address', function(event, domain) {
        $scope.closeModals();
        $scope.addAddress(domain);
    });

    $scope.$on('mx', function(event, domain) {
        $scope.closeModals();
        $scope.mx(domain);
    });

    $scope.$on('dkim', function(event, domain) {
        $scope.closeModals();
        $scope.dkim(domain);
    });

    $scope.$on('verification', function(event, domain) {
        $scope.closeModals();
        $scope.verification(domain);
    });

    $scope.$on('dmarc', function(event, domain) {
        $scope.closeModals();
        $scope.dmarc(domain);
    });

    $scope.$on('organizationChange', function(event, organization) {
        $scope.organization = organization;
    });

    $scope.$on('deleteDomain', function(event, domainId) {
        var index = _.findIndex($scope.domains, {ID: domainId});

        if (index !== -1) {
            $scope.domains.splice(index, 1);
        }
    });

    $scope.$on('createDomain', function(event, domainId, domain) {
        var index = _.findIndex($scope.domains, {ID: domainId});

        if (index === -1) {
            $scope.domains.push(domain);
        } else {
            _.extend($scope.domains[index], domain);
        }
    });

    $scope.$on('updateDomain', function(event, domainId, domain) {
        var index = _.findIndex($scope.domains, {ID: domainId});

        if (index === -1) {
            $scope.domains.push(domain);
        } else {
            _.extend($scope.domains[index], domain);
        }
    });

    $scope.$on('deleteMember', function(event, memberId) {
        var index = _.findIndex($scope.members, {ID: memberId});

        if (index !== -1) {
            $scope.members.splice(index, 1);
        }
    });

    $scope.$on('createMember', function(event, memberId, member) {
        var index = _.findIndex($scope.members, {ID: memberId});

        if (index === -1) {
            $scope.members.push(member);
        } else {
            _.extend($scope.members[index], member);
        }
    });

    $scope.$on('updateMember', function(event, memberId, member) {
        var index = _.findIndex($scope.members, {ID: memberId});

        if (index === -1) {
            $scope.members.push(member);
        } else {
            _.extend($scope.members[index], member);
        }
    });

    /**
     * Open modal process to add a custom domain.
     * @param {Object} domain
     * Docs: https://github.com/ProtonMail/Slim-API/blob/develop_domain/api-spec/pm_api_domains.md
     */
    $scope.wizard = function(domain) {
        // go through all steps and show the user the step they need to complete next. allow for back and next options.
        // if domain has a name, we can skip the first step
        /* steps:
            1. verify ownership with txt record
            2. add addresses
            3. add mx
            4. add spf
            5. add dkim
            6. add dmarc
        */
        if (!domain.DomainName) {
            // show first step
            $scope.addDomain();
        } else if ((domain.VerifyState !== 2)) {
            $scope.verification(domain);
        } else if (domain.Addresses.length === 0) {
            $scope.addAddress(domain);
        } else if (domain.MxState !== 3) {
            $scope.mx(domain);
        } else if (domain.SpfState !== 3) {
            $scope.spf(domain);
        } else if (domain.DkimState !== 4) {
            $scope.dkim(domain);
        } else if (domain.DmarcState !== 3) {
            $scope.dmarc(domain);
        }
    };

    /**
     * Delete domain
     * @param {Object} domain
     */
    $scope.deleteDomain = function(domain) {
        var index = $scope.domains.indexOf(domain);

        confirmModal.activate({
            params: {
                title: $translate.instant('DELETE_DOMAIN'),
                message: $translate.instant('Are you sure you want to delete this domain? This action will also delete addresses linked.'),
                confirm: function() {
                    networkActivityTracker.track(Domain.delete(domain.ID).then(function(result) {
                        if(angular.isDefined(result.data) && result.data.Code === 1000) {
                            notify({message: $translate.instant('DOMAIN_DELETED'), classes: 'notification-success'});
                            $scope.domains.splice(index, 1); // Remove domain in interface
                            eventManager.call(); // Call event log manager
                            confirmModal.deactivate();
                        } else if(angular.isDefined(result.data) && result.data.Error) {
                            notify({message: result.data.Error, classes: 'notification-danger'});
                        } else {
                            notify({message: $translate.instant('ERROR_DURING_DELETION'), classes: 'notification-danger'});
                        }
                    }, function(error) {
                        notify({message: $translate.instant('ERROR_DURING_DELETION'), classes: 'notification-danger'});
                    }));
                },
                cancel: function() {
                    confirmModal.deactivate();
                }
            }
        });
    };

    /**
     * Check if this address is owned by the current user
     * @param {Object} address
     * @return {Boolean}
     */
    $scope.owned = function(address) {
        var found = _.findWhere(authentication.user.Addresses, {ID: address.ID});

        return angular.isDefined(found);
    };

    /**
     * Check if this address is owned by a private member
     * @param {Object} address
     * @return {Boolean}
     */
    $scope.privated = function(address) {
        var member = _.findWhere($scope.members, {ID: address.MemberID});

        return member.Private === 1;
    };

    /**
     * Open modal to generate key pair
     */
    $scope.generate = function(address) {
        generateModal.activate({
            params: {
                title: $translate.instant('GENERATE_KEY_PAIR'),
                message: '', // TODO need text
                addresses: [address],
                cancel: function() {
                    eventManager.call();
                    generateModal.deactivate();
                }
            }
        });
    };

    /**
     * Delete address
     * @param {Object} address
     * @param {Object} domain
     */
    $scope.deleteAddress = function(address, domain) {
        var index = domain.Addresses.indexOf(address);

        confirmModal.activate({
            params: {
                title: $translate.instant('DELETE_ADDRESS'),
                message: $translate.instant('Are you sure you want to delete this address?'),
                confirm: function() {
                    networkActivityTracker.track(Address.delete(address.ID).then(function(result) {
                        if(angular.isDefined(result.data) && result.data.Code === 1000) {
                            notify({message: $translate.instant('ADDRESS_DELETED'), classes: 'notification-success'});
                            domain.Addresses.splice(index, 1); // Remove address in interface
                            eventManager.call(); // Call event log manager
                            confirmModal.deactivate();
                        } else if(angular.isDefined(result.data) && result.data.Error) {
                            notify({message: result.data.Error, classes: 'notification-danger'});
                        } else {
                            notify({message: $translate.instant('ERROR_DURING_DELETION'), classes: 'notification-danger'});
                        }
                    }, function(error) {
                        notify({message: $translate.instant('ERROR_DURING_DELETION'), classes: 'notification-danger'});
                    }));
                },
                cancel: function() {
                    confirmModal.deactivate();
                }
            }
        });
    };

    /**
     * Enable an address
     */
    $scope.enableAddress = function(address) {
        networkActivityTracker.track(Address.enable(address.ID).then(function(result) {
            if(angular.isDefined(result.data) && result.data.Code === 1000) {
                notify({message: $translate.instant('ADDRESS_ENABLED'), classes: 'notification-success'});
                address.Status = 1;
            } else if(angular.isDefined(result.data) && result.data.Error) {
                notify({message: result.data.Error, classes: 'notification-danger'});
            } else {
                notify({message: $translate.instant('ERROR_DURING_ENABLE'), classes: 'notification-danger'});
            }
        }, function(error) {
            notify({message: $translate.instant('ERROR_DURING_ENABLE'), classes: 'notification-danger'});
        }));
    };

    /**
     * Open a modal to disable an address
     */
    $scope.disableAddress = function(address) {
        confirmModal.activate({
            params: {
                title: $translate.instant('DISABLE_ADDRESS'),
                message: $translate.instant('Are you sure you want to disable this address?'),
                confirm: function() {
                    networkActivityTracker.track(Address.disable(address.ID).then(function(result) {
                        if(angular.isDefined(result.data) && result.data.Code === 1000) {
                            notify({message: $translate.instant('ADDRESS_DISABLED'), classes: 'notification-success'});
                            address.Status = 0;
                            confirmModal.deactivate();
                        } else if(angular.isDefined(result.data) && result.data.Error) {
                            notify({message: result.data.Error, classes: 'notification-danger'});
                        } else {
                            notify({message: $translate.instant('ERROR_DURING_DISABLE'), classes: 'notification-danger'});
                        }
                    }, function(error) {
                        notify({message: $translate.instant('ERROR_DURING_DISABLE'), classes: 'notification-danger'});
                    }));
                },
                cancel: function() {
                    confirmModal.deactivate();
                }
            }
        });
    };

    /**
     * Open modal process to add a custom domain
     */
    $scope.addDomain = function(domain) {
        domainModal.activate({
            params: {
                step: 1,
                domain: domain,
                submit: function(name) {
                    networkActivityTracker.track(Domain.create({Name: name}).then(function(result) {
                        if(angular.isDefined(result.data) && result.data.Code === 1000) {
                            notify({message: $translate.instant('DOMAIN_CREATED'), classes: 'notification-success'});
                            $scope.domains.push(result.data.Domain);
                            eventManager.call(); // Call event log manager
                            domainModal.deactivate();
                            // open the next step
                            $scope.verification(result.data.Domain);
                        } else if(angular.isDefined(result.data) && result.data.Error) {
                            notify({message: result.data.Error, classes: 'notification-danger'});
                        } else {
                            notify({message: $translate.instant('ERROR_DURING_CREATION'), classes: 'notification-danger'});
                        }
                    }, function(error) {
                        notify({message: $translate.instant('ERROR_DURING_CREATION'), classes: 'notification-danger'});
                    }));
                },
                next: function() {
                    domainModal.deactivate();
                    $scope.verification(domain);
                },
                cancel: function() {
                    domainModal.deactivate();
                }
            }
        });
    };

    /**
     * Refresh status for a domain
     * @param {Object} domain
     */
    $scope.refreshStatus = function(domains) {
        networkActivityTracker.track(Domain.query().then(function(result) {
            if (result.data && result.data.Code === 1000) {
                $scope.domains = result.data.Domains;
            }
        }));
    };

    /**
     * Open verification modal
     * @param {Object} domain
     */
    $scope.verification = function(domain) {
        var index = $scope.domains.indexOf(domain);

        verificationModal.activate({
            params: {
                domain: domain,
                step: 2,
                submit: function() {
                    networkActivityTracker.track(Domain.get(domain.ID).then(function(result) {
                        if(angular.isDefined(result.data) && result.data.Code === 1000) {
                            // check verification code
                            // 0 is default, 1 is has code but wrong, 2 is good
                            switch (result.data.Domain.VerifyState) {
                                case 0:
                                    notify({message: $translate.instant('VERIFICATION_DID_NOT_SUCCEED'), classes: 'notification-danger'});
                                    break;
                                case 1:
                                    notify({
                                        message: $translate.instant('HAS_CODE_BUT_WRONG'),
                                        classes: 'notification-danger',
                                        duration: 30000
                                    });
                                    break;
                                case 2:
                                    notify({message: $translate.instant('DOMAIN_VERIFIED'), classes: 'notification-success'});
                                    $scope.domains[index] = result.data.Domain;
                                    verificationModal.deactivate();
                                    // open the next step
                                    $scope.addAddress(result.data.Domain);
                                    break;
                                default:
                                    break;
                            }
                        } else if(angular.isDefined(result.data) && result.data.Error) {
                            notify({message: result.data.Error, classes: 'notification-danger'});
                        } else {
                            notify({message: $translate.instant('VERIFICATION_DID_NOT_SUCCEED'), classes: 'notification-danger'});
                        }
                    }, function(error) {
                        notify({message: $translate.instant('VERIFICATION_DID_NOT_SUCCEED'), classes: 'notification-danger'});
                    }));
                },
                next: function() {
                    $scope.addAddress(domain);
                },
                close: function() {
                    verificationModal.deactivate();
                }
            }
        });
    };

    /**
     * Open modal to add a new address
     */
    $scope.addAddress = function(domain) {
        var index = $scope.domains.indexOf(domain);

        addressModal.activate({
            params: {
                step: 3,
                domain: domain,
                members: $scope.members,
                next: function() {
                    addressModal.deactivate();
                    $scope.mx(domain);
                },
                cancel: function() {
                    addressModal.deactivate();
                    eventManager.call();
                }
            }
        });
    };

    /**
     * Open MX modal
     * @param {Object} domain
     */
    $scope.mx = function(domain) {
        mxModal.activate({
            params: {
                domain: domain,
                step: 4,
                next: function() {
                    mxModal.deactivate();
                    $scope.spf(domain);

                },
                close: function() {
                    mxModal.deactivate();
                    eventManager.call();
                }
            }
        });
    };

    /**
     * Open SPF modal
     * @param {Object} domain
     */
    $scope.spf = function(domain) {
        spfModal.activate({
            params: {
                domain: domain,
                step: 5,
                next: function() {
                    spfModal.deactivate();
                    $scope.dkim(domain);
                },
                close: function() {
                    spfModal.deactivate();
                    eventManager.call();
                }
            }
        });
    };

    /**
     * Open DKIM modal
     * @param {Object} domain
     */
    $scope.dkim = function(domain) {
        var index = $scope.domains.indexOf(domain);

        dkimModal.activate({
            params: {
                domain: domain,
                step: 6,
                next: function() {
                    dkimModal.deactivate();
                    $scope.dmarc(domain);
                },
                close: function() {
                    dkimModal.deactivate();
                    eventManager.call();
                }
            }
        });
    };

    /**
     * Open DMARC modal
     * @param {Object} domain
     */
    $scope.dmarc = function(domain) {
        var index = $scope.domains.indexOf(domain);

        dmarcModal.activate({
            params: {
                domain: domain,
                step: 7,
                verify: function() {
                    networkActivityTracker.track(Domain.get(domain.ID).then(function(result) {
                        if(angular.isDefined(result.data) && result.data.Code === 1000) {
                            $scope.domains[index] = result.data.Domain;
                            dmarcModal.deactivate();
                            eventManager.call();
                        } else if(angular.isDefined(result.data) && result.data.Error) {
                            notify({message: result.data.Error, classes: 'notification-danger'});
                        } else {
                            notify({message: $translate.instant('VERIFICATION_DID_NOT_SUCCEED'), classes: 'notification-danger'});
                        }
                    }, function(error) {
                        notify({message: $translate.instant('VERIFICATION_DID_NOT_SUCCEED'), classes: 'notification-danger'});
                    }));
                },
                close: function() {
                    dmarcModal.deactivate();
                    eventManager.call();
                }
            }
        });
    };

    /**
     * Close all verification modals
     */
    $scope.closeModals = function() {
        domainModal.deactivate();
        verificationModal.deactivate();
        dkimModal.deactivate();
        dmarcModal.deactivate();
        spfModal.deactivate();
        mxModal.deactivate();
        addressModal.deactivate();
    };

    /**
     * Return member Object for a specific memberId
     * @param {String} memberId
     * @return {Object} member
     */
    $scope.member = function(memberId) {
        var member = _.findWhere($scope.members, {ID: memberId});

        if (angular.isDefined(member)) {
            return member;
        }
    };

    /**
     * Change user model value (select)
     */
    $scope.changeMember = function(address) {

    };
});
