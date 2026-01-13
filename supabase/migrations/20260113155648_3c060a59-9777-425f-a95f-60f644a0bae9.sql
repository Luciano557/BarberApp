-- Remove incorrect owner role from Tomas Bazante
DELETE FROM user_roles 
WHERE user_id = '99acebde-9971-46b3-9cc3-1763fa412916' 
AND role = 'owner';